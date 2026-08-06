import { beforeEach, describe, expect, it } from "vitest";
import {
  AREAS,
  AREAS_DEFAULT,
  AREA_OPTIONS,
  getAreaColor,
  getAreaLabel,
  getCustomAreas,
  isCustomAreaKey,
  loadAreaNamesForWorkspace,
  makeCustomAreaKey,
  setCustomAreaNames,
} from "@/lib/areas";

const WS = "ws-1";

describe("áreas criadas pelo owner", () => {
  beforeEach(() => {
    loadAreaNamesForWorkspace(WS);
    setCustomAreaNames({}, WS);
  });

  it("começa apenas com as 4 áreas padrão", () => {
    expect(AREAS).toHaveLength(AREAS_DEFAULT.length);
    expect(AREAS.map(a => a.key)).toEqual(AREAS_DEFAULT.map(a => a.key));
  });

  it("chave criada é reconhecida como custom e a padrão não", () => {
    expect(isCustomAreaKey(makeCustomAreaKey())).toBe(true);
    expect(isCustomAreaKey("projetos")).toBe(false);
  });

  it("nova área entra em AREAS com rota, nome e cor próprios", () => {
    const key = makeCustomAreaKey();
    setCustomAreaNames({ [key]: "Comercial" }, WS);

    const nova = AREAS.find(a => a.key === key);
    expect(nova).toBeDefined();
    expect(nova!.label).toBe("Comercial");
    expect(nova!.path).toBe(`/${key}`);
    expect(nova!.color).toMatch(/^#[0-9A-F]{6}$/i);

    expect(getAreaLabel(key)).toBe("Comercial");
    expect(getAreaColor(key)).toBe(nova!.color);
    expect(AREA_OPTIONS.some(o => o.value === key)).toBe(true);
  });

  it("mantém as áreas padrão ao lado das criadas", () => {
    const key = makeCustomAreaKey();
    setCustomAreaNames({ [key]: "Comercial" }, WS);

    expect(AREAS).toHaveLength(AREAS_DEFAULT.length + 1);
    AREAS_DEFAULT.forEach(d => {
      expect(AREAS.some(a => a.key === d.key)).toBe(true);
    });
  });

  it("renomear a área padrão não cria área nova", () => {
    setCustomAreaNames({ projetos: "Operações" }, WS);

    expect(AREAS).toHaveLength(AREAS_DEFAULT.length);
    expect(getAreaLabel("projetos")).toBe("Operações");
    expect(getCustomAreas(WS)).toHaveLength(0);
  });

  it("remover a chave tira a área da lista", () => {
    const key = makeCustomAreaKey();
    setCustomAreaNames({ [key]: "Comercial" }, WS);
    expect(AREAS.some(a => a.key === key)).toBe(true);

    setCustomAreaNames({}, WS);
    expect(AREAS.some(a => a.key === key)).toBe(false);
    expect(AREAS).toHaveLength(AREAS_DEFAULT.length);
  });

  it("duas áreas criadas convivem e mantêm cores estáveis", () => {
    const a1 = makeCustomAreaKey();
    const a2 = makeCustomAreaKey();
    setCustomAreaNames({ [a1]: "Comercial", [a2]: "Pesquisa" }, WS);

    expect(AREAS).toHaveLength(AREAS_DEFAULT.length + 2);
    expect(getAreaColor(a1)).toBe(getAreaColor(a1)); // determinística
    expect(getAreaLabel(a2)).toBe("Pesquisa");
  });
});
