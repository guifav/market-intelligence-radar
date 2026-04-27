"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface DivisionCtx {
  division: string;
  setDivision: (d: string) => void;
}

const Ctx = createContext<DivisionCtx>({ division: "", setDivision: () => {} });

export function DivisionProvider({ children }: { children: ReactNode }) {
  const [division, setDivision] = useState("");
  return <Ctx.Provider value={{ division, setDivision }}>{children}</Ctx.Provider>;
}

export function useDivision() {
  return useContext(Ctx);
}
