import { describe, expect, it } from "vitest";

/**
 * Regras de destino e contagem dos formulários, espelhando o que a
 * FormsSection usa. Mantidas aqui para travar o comportamento:
 * - um formulário pode mirar vários times/áreas
 * - formulários antigos (destino único) continuam valendo
 * - "não vou preencher" não conta como preenchido
 */

type Form = {
  id: string;
  targetType: "all" | "area" | "team";
  targetValue: string | null;
  targetValues: string[];
};
type Completion = { formId: string; userId: string; status: "done" | "declined" };

const formTargets = (f: Form) =>
  f.targetValues?.length ? f.targetValues : (f.targetValue ? [f.targetValue] : []);

const isEligible = (f: Form, myAreas: Set<string>, myTeams: Set<string>) => {
  if (f.targetType === "all") return true;
  const targets = formTargets(f);
  if (f.targetType === "area") return targets.some(v => myAreas.has(v));
  if (f.targetType === "team") return targets.some(v => myTeams.has(v));
  return false;
};

const filledCount = (formId: string, cs: Completion[]) =>
  cs.filter(c => c.formId === formId && c.status !== "declined").length;

describe("destinos do formulário", () => {
  const semTimes = new Set<string>();

  it("mira vários times ao mesmo tempo", () => {
    const f: Form = { id: "f1", targetType: "team", targetValue: null, targetValues: ["t1", "t2"] };
    expect(isEligible(f, new Set(), new Set(["t2"]))).toBe(true);
    expect(isEligible(f, new Set(), new Set(["t3"]))).toBe(false);
  });

  it("mira várias áreas ao mesmo tempo", () => {
    const f: Form = { id: "f2", targetType: "area", targetValue: null, targetValues: ["mercado", "gg"] };
    expect(isEligible(f, new Set(["gg"]), semTimes)).toBe(true);
    expect(isEligible(f, new Set(["projetos"]), semTimes)).toBe(false);
  });

  it("formulário antigo com destino único continua valendo", () => {
    const antigo: Form = { id: "f3", targetType: "team", targetValue: "t9", targetValues: [] };
    expect(formTargets(antigo)).toEqual(["t9"]);
    expect(isEligible(antigo, new Set(), new Set(["t9"]))).toBe(true);
  });

  it('"todos" vale para qualquer pessoa', () => {
    const f: Form = { id: "f4", targetType: "all", targetValue: null, targetValues: [] };
    expect(isEligible(f, new Set(), semTimes)).toBe(true);
  });
});

describe("contagem de preenchidos", () => {
  const cs: Completion[] = [
    { formId: "f1", userId: "u1", status: "done" },
    { formId: "f1", userId: "u2", status: "declined" },
    { formId: "f1", userId: "u3", status: "done" },
  ];

  it("recusa não conta como preenchido", () => {
    expect(filledCount("f1", cs)).toBe(2);
  });

  it("formulário sem respostas conta zero", () => {
    expect(filledCount("f2", cs)).toBe(0);
  });
});
