import { beforeEach, describe, expect, it, vi } from "vitest";
import { carregarTela } from "@/lib/carregarTela";

/**
 * Regressão: depois de um deploy, uma aba já aberta pedia o arquivo da tela
 * da versão antiga. O servidor devolvia a página inicial (HTML) no lugar do
 * código, o navegador não conseguia lê-la como módulo, e a tela ficava
 * carregando para sempre.
 */

function memoriaFalsa() {
  const dados = new Map<string, string>();
  return {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => { dados.set(k, v); },
    removeItem: (k: string) => { dados.delete(k); },
    tamanho: () => dados.size,
  };
}

describe("carregar o arquivo de uma tela", () => {
  let recarregar: ReturnType<typeof vi.fn>;
  let memoria: ReturnType<typeof memoriaFalsa>;

  beforeEach(() => {
    recarregar = vi.fn();
    memoria = memoriaFalsa();
  });

  it("caminho normal: entrega a tela e não recarrega nada", async () => {
    const tela = { default: () => null };
    const r = await carregarTela(() => Promise.resolve(tela), { recarregar, memoria });
    expect(r).toBe(tela);
    expect(recarregar).not.toHaveBeenCalled();
  });

  it("arquivo sumido: recarrega a página uma vez", async () => {
    carregarTela(() => Promise.reject(new Error("Failed to fetch module")), { recarregar, memoria });
    await Promise.resolve();
    await Promise.resolve();
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it("enquanto recarrega, a promessa não resolve — a tela não pisca errado", async () => {
    const p = carregarTela(() => Promise.reject(new Error("boom")), { recarregar, memoria });
    const corrida = await Promise.race([p, Promise.resolve("ainda-pendente")]);
    expect(corrida).toBe("ainda-pendente");
  });

  it("falhando de novo, não recarrega em laço: o erro sobe", async () => {
    // Primeira falha: recarrega
    carregarTela(() => Promise.reject(new Error("um")), { recarregar, memoria });
    await Promise.resolve();
    await Promise.resolve();
    expect(recarregar).toHaveBeenCalledTimes(1);

    // Segunda falha na mesma sessão: o problema é outro, então propaga
    await expect(
      carregarTela(() => Promise.reject(new Error("dois")), { recarregar, memoria }),
    ).rejects.toThrow("dois");
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it("um carregamento bem-sucedido libera a recarga para o próximo deploy", async () => {
    carregarTela(() => Promise.reject(new Error("um")), { recarregar, memoria });
    await Promise.resolve();
    await Promise.resolve();

    // Tela seguinte carrega normal: a marca é limpa
    await carregarTela(() => Promise.resolve({ default: () => null }), { recarregar, memoria });
    expect(memoria.tamanho()).toBe(0);

    // Então uma falha futura pode recarregar de novo
    carregarTela(() => Promise.reject(new Error("tres")), { recarregar, memoria });
    await Promise.resolve();
    await Promise.resolve();
    expect(recarregar).toHaveBeenCalledTimes(2);
  });

  it("sem memória disponível (modo privado) ainda recarrega", async () => {
    carregarTela(() => Promise.reject(new Error("boom")), { recarregar, memoria: undefined });
    await Promise.resolve();
    await Promise.resolve();
    expect(recarregar).toHaveBeenCalledTimes(1);
  });
});
