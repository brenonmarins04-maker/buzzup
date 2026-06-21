import type { VercelRequest, VercelResponse } from "@vercel/node";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";

type Demand = {
  title: string;
  area: string;
  person: string;
  date?: string | null;
  status: string;
  points?: number | null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: "no_api_key", message: "ANTHROPIC_API_KEY não configurada no ambiente." });

  const { pending, completed, workspaceName } = req.body as {
    pending: Demand[];
    completed: Demand[];
    workspaceName?: string;
  };

  const now = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const org = workspaceName || "a empresa";

  const fmtDemand = (d: Demand) => {
    const parts = [`"${d.title}"`, `(${d.area}`, d.person ? `— ${d.person}` : "", d.date ? `, prazo ${d.date}` : "", ")", d.status === "in-progress" ? "[em andamento]" : ""];
    return parts.filter(Boolean).join(" ");
  };

  const pendingLines = pending.length
    ? pending.map(fmtDemand).join("\n")
    : "Nenhuma demanda pendente.";

  const completedLines = completed.length
    ? completed.map(fmtDemand).join("\n")
    : "Nenhuma demanda concluída recentemente.";

  const prompt = `Você é um assistente executivo interno de ${org}. Hoje é ${now}.

Abaixo estão as demandas ativas no momento e as concluídas nos últimos 7 dias.

DEMANDAS PENDENTES (${pending.length}):
${pendingLines}

CONCLUÍDAS NOS ÚLTIMOS 7 DIAS (${completed.length}):
${completedLines}

Escreva um resumo executivo CURTO (máximo 4 parágrafos) em português do Brasil, com tom direto e profissional. Destaque: principais prioridades da semana, quem está com mais demandas, áreas mais movimentadas e qualquer prazo crítico próximo. Não use listas com bullets — apenas texto corrido.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: "anthropic_error", message: err });
    }

    const data = await response.json() as any;
    const text: string = data?.content?.[0]?.text ?? "";
    return res.status(200).json({ summary: text });
  } catch (e: any) {
    return res.status(500).json({ error: "fetch_error", message: e.message });
  }
}
