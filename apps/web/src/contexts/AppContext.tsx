"use client";

import { createContext, useContext, useReducer, type Dispatch } from "react";
import type { AppState } from "@sessionmap/types";
import { reducer, initialState, type Action } from "./reducer";
import { usePrices } from "@/hooks/usePrices";

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  usePrices(state.prices, dispatch, state.wsStatus);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used inside AppProvider");
  return ctx;
}
