"use client";

import { createContext, useContext } from "react";

/** Set by <ScoutGate> once the user is confirmed as an approved scout. */
export const ScoutContext = createContext<string | null>(null);

/** The approved scout's user id. Only valid inside <ScoutGate>. */
export function useScout() {
  return useContext(ScoutContext);
}
