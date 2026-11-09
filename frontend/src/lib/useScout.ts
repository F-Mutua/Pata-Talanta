"use client";

import { createContext, useContext } from "react";

/** Set by <ScoutGate> once the user is confirmed as a scout. */
export const ScoutContext = createContext<string | null>(null);

/** The scout's user id. Only valid inside <ScoutGate>. */
export function useScout() {
  return useContext(ScoutContext);
}
