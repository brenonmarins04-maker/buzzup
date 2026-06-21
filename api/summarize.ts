import type { VercelRequest, VercelResponse } from "@vercel/node";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";

type Demand = { title: string; person: string };
type AreaData = { areaName: string; demands: Demand[] };

async function generateAreaSummary(areaName: string, demands: Demand[]): Promise<string> {
  if (demands.length === 0) {
    return `Sem demandas previstas para ${areaName} nas próximas semanas.`;
  }

  const list = demands.map(d => `• ${d.title}${d.person ? ` (${d.person})` : ""}`).join("\n");

  const prompt = `Você é um assistente da área de ${areaName}. Resuma em texto corrido, português do Brasil, máximo 450 caracteres, APENAS as demandas listadas. Não invente nada além do que está na lista. Não mencione datas específicas.

Demandas:
${list}

Resumo:`;

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
  // Garante máximo de 450 caracteres
  if (text.length > 450) text = text.slice(0, 447) + "…";
  return text;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: "no_api_key", message: "ANTHROPIC_API_KEY não configurada." });

  const body = req.body as { areas?: Record<string, AreaData> } | null;
  const areas = body?.areas;

  if (!areas || typeof areas !== "object") {
    return res.status(400).json({ error: "bad_request", message: "areas é obrigatório." });
  }

  try {
    const entries = Object.entries(areas);
    const results = await Promise.all(
      entries.map(async ([key, area]) => {
        const text = await generateAreaSummary(area.areaName, area.demands);
        return [key, text] as [string, string];
      })
    );
    const summaries = Object.fromEntries(results);
    return res.status(200).json({ summaries });
  } catch (e: any) {
    return res.status(502).json({ error: "anthropic_error", message: e.message });
  }
}
