import { createContext, useContext, useState } from "react";

interface AuthTransitionCtx {
  leaving: boolean;
  setLeaving: (v: boolean) => void;
}

const Ctx = createContext<AuthTransitionCtx>({ leaving: false, setLeaving: () => {} });

export function AuthTransitionProvider({ children }: { children: React.ReactNode }) {
  const [leaving, setLeaving] = useState(false);
  return <Ctx.Provider value={{ leaving, setLeaving }}>{children}</Ctx.Provider>;
}

export const useAuthTransition = () => useContext(Ctx);
