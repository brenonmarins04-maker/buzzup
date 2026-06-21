import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://twwcnudhfvzbkdrtfmtu.supabase.co";
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || "").replace(/[^A-Za-z0-9._\-]/g, "").trim();
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";

const AREA_NAMES: Record<string, string> = {
  projetos: "Geral",
  mercado: "Marketing",
  gg: "Financeiro",
  presidencia: "Eventos / Projetos",
};
const AREA_KEYS = Object.keys(AREA_NAMES);

async function generateAreaSummary(areaName: string, demands: { title: string; person: string }[]): Promise<string> {
  if (demands.length === 0) return `Sem demandas previstas para ${areaName} nas próximas semanas.`;

  const list = demands.map(d => `• ${d.title}${d.person ? ` (${d.person})` : ""}`).join("\n");
  const prompt = `Você é um assistente da área de ${areaName}. Resuma em texto corrido, português do Brasil, máximo 450 caracteres, APENAS as demandas listadas. Não invente nada além do que está na lista. Não mencione datas específicas.\n\nDemandas:\n${list}\n\nResumo:`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(await response.text());
  const data = await response.json() as any;
  let text: string = data?.content?.[0]?.text ?? "";
  if (text.length > 450) text = text.slice(0, 447) + "…";
  return text;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel envia Authorization: Bearer <CRON_SECRET>
  const auth = req.headers["authorization"] ?? "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "unauthorized" });
  }

  if (!SERVICE_KEY || !ANTHROPIC_KEY) {
    return res.status(500).json({ error: "missing_env" });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // Busca todos os workspaces que já usaram o recurso de resumo
  const { data: wsRows, error: wsErr } = await db
    .from("workspace_summaries" as any)
    .select("workspace_id");

  if (wsErr) return res.status(500).json({ error: wsErr.message });
  const workspaceIds: string[] = (wsRows ?? []).map((r: any) => r.workspace_id);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const in21 = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const results: { wsId: string; ok: boolean; error?: string }[] = [];

  for (const wsId of workspaceIds) {
    try {
      // Busca demandas das próximas 3 semanas
      const { data: items } = await db
        .from("parking_items" as any)
        .select("title, area, person_id")
        .eq("workspace_id", wsId)
        .neq("status", "done")
        .gte("date", todayStr)
        .lte("date", in21);

      // Busca nomes das pessoas
      const personIds: string[] = [...new Set(
        (items ?? []).map((i: any) => i.person_id).filter(Boolean)
      )];
      const { data: persons } = personIds.length > 0
        ? await db.from("people" as any).select("id, name").in("id", personIds)
        : { data: [] };
      const nameMap: Record<string, string> = {};
      (persons ?? []).forEach((p: any) => { nameMap[p.id] = p.name; });

      // Agrupa por área
      const byArea: Record<string, { title: string; person: string }[]> = {};
      AREA_KEYS.forEach(k => { byArea[k] = []; });
      (items ?? []).forEach((item: any) => {
        if (item.area && byArea[item.area]) {
          byArea[item.area].push({
            title: item.title,
            person: nameMap[item.person_id] ?? "",
          });
        }
      });

      // Gera resumos em paralelo
      const summaryEntries = await Promise.all(
        AREA_KEYS.map(async key => {
          const text = await generateAreaSummary(AREA_NAMES[key], byArea[key]);
          return [key, text] as [string, string];
        })
      );
      const summaries = Object.fromEntries(summaryEntries);

      await db.from("workspace_summaries" as any).upsert({
        workspace_id: wsId,
        summaries,
        generated_at: new Date().toISOString(),
        generated_by: null,
      }, { onConflict: "workspace_id" });

      results.push({ wsId, ok: true });
    } catch (e: any) {
      results.push({ wsId, ok: false, error: e.message });
    }
  }

  return res.status(200).json({ updated: results.length, results });
}
