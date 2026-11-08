"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { ScoutContext } from "@/lib/useScout";

/**
 * Lets scouts into the scout area; sends everyone else to the player
 * dashboard. A scout is anyone who signed up as one — there is no review.
 * What they can see is limited by RLS to players who turned on
 * `discoverable`.
 */
export default function ScoutGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [scoutId, setScoutId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.replace("/login");

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      // The signup trigger may have stored "player", so also accept the role
      // chosen on the signup form (user metadata).
      if (profile?.role === "scout" || user.user_metadata?.role === "scout") {
        setScoutId(user.id);
      } else {
        router.replace("/dashboard");
      }
    })();
  }, [router]);

  if (!scoutId) {
    return <p className="px-6 py-12 text-[#AEB5C0]">Loading the scout dashboard…</p>;
  }
  return <ScoutContext value={scoutId}>{children}</ScoutContext>;
}
