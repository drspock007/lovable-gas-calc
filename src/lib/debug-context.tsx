import React, { createContext, useContext, useEffect, useState } from "react";

type DebugCtx = { debug: boolean; setDebug: (v: boolean) => void };
const Ctx = createContext<DebugCtx>({ debug: false, setDebug: () => {} });

export function DebugProvider({ children }: { children: React.ReactNode }) {
  const [debug, setDebug] = useState<boolean>(() => localStorage.getItem("debugMode") === "1");
  useEffect(() => { localStorage.setItem("debugMode", debug ? "1" : "0"); }, [debug]);
  return <Ctx.Provider value={{ debug, setDebug }}>{children}</Ctx.Provider>;
}

export const useDebug = () => useContext(Ctx);