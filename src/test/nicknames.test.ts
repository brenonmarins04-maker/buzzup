import { describe, expect, it } from "vitest";
import {
  areasOf,
  groupPeopleByArea,
  hasNickname,
  peopleForReset,
  progressOf,
  SEM_AREA,
  TODAS_AS_AREAS,
  type AreaOption,
  type NickPerson,
} from "@/lib/nicknames";
import { matchesSearch, normalizeForSearch } from "@/lib/utils";

const areas: AreaOption[] = [
  { key: "mercado", label: "Marketing", color: "#F97316" },
  { key: "gg", label: "Financeiro", color: "#10B981" },
  { key: "vazia", label: "Sem gente", color: "#000000" },
];

const people: NickPerson[] = [
  { id: "ana", name: "Ana Souza", nickname: "Aninha", areas: ["mercado"] },
  { id: "bia", name: "Bia Lima", nickname: null, areas: ["mercado", "gg"] },
  { id: "caio", name: "Caio Reis", nickname: "  ", areas: ["gg"] },
  { id: "duda", name: "Duda Alves", nickname: "Du", areas: [] },
  { id: "eva", name: "Eva Nunes", areas: [] },
];

describe("apelido preenchido", () => {
  it("espaço em branco não conta como apelido", () => {
    expect(hasNickname({ id: "x", name: "X", nickname: "  " })).toBe(false);
    expect(hasNickname({ id: "x", name: "X", nickname: null })).toBe(false);
    expect(hasNickname({ id: "x", name: "X" })).toBe(false);
    expect(hasNickname({ id: "x", name: "X", nickname: "Xis" })).toBe(true);
  });
});

describe("áreas da pessoa", () => {
  it("usa a lista quando existe", () => {
    expect(areasOf({ id: "x", name: "X", areas: ["gg", "mercado"] })).toEqual(["gg", "mercado"]);
  });

  it("aceita o formato antigo separado por vírgula", () => {
    expect(areasOf({ id: "x", name: "X", area: "gg,mercado" })).toEqual(["gg", "mercado"]);
    expect(areasOf({ id: "x", name: "X", area: " gg , mercado " })).toEqual(["gg", "mercado"]);
  });

  it("sem área nenhuma devolve lista vazia", () => {
    expect(areasOf({ id: "x", name: "X" })).toEqual([]);
    expect(areasOf({ id: "x", name: "X", area: "  " })).toEqual([]);
  });
});

describe("agrupar por área", () => {
  const grupos = groupPeopleByArea(people, areas);

  it("separa quem tem e quem não tem apelido", () => {
    const mercado = grupos.find(g => g.key === "mercado")!;
    expect(mercado.comApelido.map(p => p.id)).toEqual(["ana"]);
    expect(mercado.semApelido.map(p => p.id)).toEqual(["bia"]);
  });

  it("quem está em duas áreas aparece nas duas", () => {
    const gg = grupos.find(g => g.key === "gg")!;
    expect(gg.people.map(p => p.id)).toEqual(["bia", "caio"]);
    // Caio tem só espaços no apelido: conta como sem apelido
    expect(gg.semApelido.map(p => p.id)).toEqual(["bia", "caio"]);
  });

  it("junta quem não está em área nenhuma", () => {
    const semArea = grupos.find(g => g.key === SEM_AREA)!;
    expect(semArea.people.map(p => p.id)).toEqual(["duda", "eva"]);
    expect(semArea.comApelido.map(p => p.id)).toEqual(["duda"]);
  });

  it("área sem ninguém não entra na lista", () => {
    expect(grupos.some(g => g.key === "vazia")).toBe(false);
  });

  it("calcula o progresso da área", () => {
    const mercado = grupos.find(g => g.key === "mercado")!;
    expect(progressOf(mercado)).toEqual({ filled: 1, total: 2, pct: 50 });
  });

  it("sem gente nenhuma não devolve grupo", () => {
    expect(groupPeopleByArea([], areas)).toEqual([]);
  });
});

describe("quem é afetado pelo reset", () => {
  it("todas as áreas pega só quem tem apelido", () => {
    expect(peopleForReset(people, TODAS_AS_AREAS).map(p => p.id)).toEqual(["ana", "duda"]);
  });

  it("filtrando por área, só quem é da área e tem apelido", () => {
    expect(peopleForReset(people, "mercado").map(p => p.id)).toEqual(["ana"]);
    // Em gg ninguém tem apelido de verdade
    expect(peopleForReset(people, "gg")).toEqual([]);
  });

  it("o grupo sem área também filtra", () => {
    expect(peopleForReset(people, SEM_AREA).map(p => p.id)).toEqual(["duda"]);
  });

  it("área inexistente não pega ninguém", () => {
    expect(peopleForReset(people, "nao-existe")).toEqual([]);
  });
});

describe("busca sem acento", () => {
  it("tira acentos e caixa", () => {
    expect(normalizeForSearch("Luísa")).toBe("luisa");
    expect(normalizeForSearch("JOÃO")).toBe("joao");
    expect(normalizeForSearch("  Ângela ")).toBe("angela");
    expect(normalizeForSearch("Conceição")).toBe("conceicao");
  });

  it("acha o nome com ou sem acento digitado", () => {
    expect(matchesSearch("Luísa Prado", "luisa")).toBe(true);
    expect(matchesSearch("Luisa Prado", "luísa")).toBe(true);
    expect(matchesSearch("João Antônio", "joao anton")).toBe(true);
    expect(matchesSearch("Ângela", "ANGELA")).toBe(true);
  });

  it("não confunde nomes diferentes", () => {
    expect(matchesSearch("Luísa", "larissa")).toBe(false);
  });

  it("busca vazia passa tudo, texto vazio não quebra", () => {
    expect(matchesSearch("Luísa", "")).toBe(true);
    expect(matchesSearch(null, "luisa")).toBe(false);
    expect(matchesSearch(undefined, "")).toBe(true);
  });
});
