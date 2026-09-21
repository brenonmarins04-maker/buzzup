import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Responde por arquivos de /assets que não existem mais.
 *
 * O Vercel serve os arquivos estáticos antes de aplicar as reescritas, então
 * só chega aqui o que sumiu — tipicamente um pedaço da versão anterior, pedido
 * por uma aba aberta antes do deploy. Sem isso a regra geral devolvia o
 * index.html: o navegador recebia HTML onde esperava código, não conseguia
 * interpretá-lo, e a tela ficava carregando para sempre.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(404).json({ error: "asset_not_found" });
}
