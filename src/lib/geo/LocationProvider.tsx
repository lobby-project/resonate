"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { ActiveLocation } from "./types";

type Ctx = {
  location: ActiveLocation | null;
  setLocation: (loc: ActiveLocation | null) => void;
};

const LocationContext = createContext<Ctx | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<ActiveLocation | null>(null);
  return (
    <LocationContext.Provider value={{ location, setLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation(): Ctx {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used inside LocationProvider");
  return ctx;
}
