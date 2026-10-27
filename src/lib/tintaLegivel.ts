// A mesma cor, escurecida até dar para ler.
//
// As cores de área e de time foram escolhidas para MARCAR — uma barra, um
// ponto, uma borda — e nisso funcionam bem. Como TEXTO sobre fundo claro elas
// falham: o laranja do Marketing sobre o próprio tom pálido mede 2,5:1, e o
// verde do Financeiro 2,3:1, contra os 4,5:1 que a norma de acessibilidade
// pede. Na prática é aquela etiqueta que some se a tela estiver no sol.
//
// Esta função mantém a MATIZ (laranja continua laranja, roxo continua roxo) e
// só baixa o brilho até a leitura passar. Assim a cor segue dizendo de que
// área é a etiqueta, sem obrigar ninguém a apertar os olhos.

/** Razão de contraste WCAG entre duas cores (1 = igual, 21 = preto/branco). */
export function contraste(corA: string, corB: string): number {
  const l = [luminancia(corA), luminancia(corB)].sort((x, y) => y - x);
  return (l[0] + 0.05) / (l[1] + 0.05);
}

function paraRgb(cor: string): [number, number, number] {
  const limpa = cor.trim();
  const hex = limpa.replace("#", "");
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return [0, 1, 2].map(i => parseInt(hex[i] + hex[i], 16)) as [number, number, number];
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  }
  const nums = limpa.match(/[\d.]+/g);
  if (nums && nums.length >= 3) {
    return [Number(nums[0]), Number(nums[1]), Number(nums[2])];
  }
  return [0, 0, 0];
}

function luminancia(cor: string): number {
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = paraRgb(cor);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function paraHex([r, g, b]: [number, number, number]): string {
  const dois = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${dois(r)}${dois(g)}${dois(b)}`;
}

/** Multiplica o brilho mantendo a matiz: cada canal cai na mesma proporção. */
function escurecer(cor: string, fator: number): string {
  const [r, g, b] = paraRgb(cor);
  return paraHex([r * fator, g * fator, b * fator]);
}

/**
 * Devolve a cor pronta para virar texto sobre `fundo`.
 *
 * Se a cor já passa, volta como está. Se não, escurece em passos pequenos até
 * passar — no limite, fica quase preta, que é melhor do que ilegível.
 */
export function tintaLegivel(cor: string, fundo = "#ffffff", minimo = 4.6): string {
  // 4,6 e não 4,5 de propósito: os fundos "brancos" do app costumam ser
  // tons levemente tingidos, e a margem evita passar raspando e falhar lá.
  if (!cor) return "#111111";
  if (contraste(cor, fundo) >= minimo) return cor;

  for (let fator = 0.95; fator >= 0.08; fator -= 0.03) {
    const tentativa = escurecer(cor, fator);
    if (contraste(tentativa, fundo) >= minimo) return tentativa;
  }
  return "#111111";
}

/**
 * O par pronto de uma etiqueta: fundo pálido da cor e texto legível nela.
 *
 * O fundo pálido é calculado de verdade (a cor misturada com branco), e não
 * por transparência, para o texto ser medido contra o tom que aparece na
 * tela — e não contra o branco que está atrás dele.
 */
export function etiquetaDaCor(cor: string, forcaDoFundo = 0.12) {
  const [r, g, b] = paraRgb(cor);
  const fundo = paraHex([
    r * forcaDoFundo + 255 * (1 - forcaDoFundo),
    g * forcaDoFundo + 255 * (1 - forcaDoFundo),
    b * forcaDoFundo + 255 * (1 - forcaDoFundo),
  ]);
  return { fundo, texto: tintaLegivel(cor, fundo) };
}

/**
 * Para quando a cor vira PREENCHIMENTO com texto branco em cima (o estado
 * selecionado de um botão, por exemplo): devolve a cor escurecida o bastante
 * para o branco passar.
 */
export function fundoParaTextoBranco(cor: string, minimo = 4.5): string {
  return tintaLegivel(cor, "#ffffff", minimo);
}
