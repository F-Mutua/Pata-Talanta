"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { ui, errorMessage } from "@/lib/ui";
import { ageFrom } from "@/lib/types";

/**
 * Shown once to every new player (the dashboard redirects here until
 * user_metadata.onboarded is set). Explains what is collected and who sees
 * it, then records the player's choice. Everything can be changed later on
 * the profile page.
 */
export default function WelcomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [discoverable, setDiscoverable] = useState(true);
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.replace("/login");
      if (user.user_metadata?.role === "scout") return router.replace("/scout");

      const { data } = await supabase
        .from("profiles")
        .select("display_name, date_of_birth, guardian_consent")
        .eq("id", user.id)
        .maybeSingle();
      setName(data?.display_name || user.user_metadata?.display_name || "");
      setDob(data?.date_of_birth || "");
      setGuardianConsent(!!data?.guardian_consent);
      setLoading(false);
    })();
  }, [router]);

  const age = ageFrom(dob);
  const isMinor = age !== null && age < 18;
  const blocked = !dob || !understood || (discoverable && isMinor && !guardianConsent);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!dob) return setError("Please add your date of birth.");
    if (age !== null && (age < 8 || age > 60)) return setError("Please check your date of birth.");
    if (discoverable && isMinor && !guardianConsent) {
      return setError("A parent or guardian must consent before scouts can see your profile.");
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session has expired. Please sign in again.");

      const now = new Date().toISOString();
      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          date_of_birth: dob,
          discoverable,
          guardian_consent: isMinor ? guardianConsent : false,
          consent_at: discoverable ? now : null,
          updated_at: now,
        })
        .eq("id", user.id);
      if (pErr) throw pErr;

      const { error: uErr } = await supabase.auth.updateUser({ data: { onboarded: true } });
      if (uErr) throw uErr;

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, "Could not save your choices."));
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#17191D] p-10 text-[#AEB5C0]">Loading…</main>;
  }

  return (
    <main className="min-h-screen bg-[#17191D] px-4 py-10 text-white sm:px-6 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-2xl font-black tracking-wider">
          PATA <span className="text-[#F47721]">TALANTA</span>
        </Link>

        <p className={`${ui.eyebrow} mt-10`}>Before you start</p>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">
          Welcome{name ? `, ${name.split(" ")[0]}` : ""}. Here&apos;s how your data is used.
        </h1>

        <section className={`${ui.card} mt-8 space-y-5`}>
          <div>
            <h2 className="font-bold text-[#F47721]">What we collect</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[#D8DCE2]">
              <li>Your name, county, playing position and date of birth.</li>
              <li>Clubs, matches and statistics you enter.</li>
              <li>Match videos you upload, and estimates we calculate from them (distance, speed, sprints, touches, heatmap).</li>
              <li>Your phone and email, only if you add them.</li>
            </ul>
          </div>
          <div>
            <h2 className="font-bold text-[#F47721]">Who can see it</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[#D8DCE2]">
              <li><strong>You</strong> can see everything you add.</li>
              <li><strong>Scouts</strong> registered on Pata Talanta see your profile, stats, heatmaps and videos — only if you turn on visibility below.</li>
              <li><strong>Your phone and email</strong> stay hidden. A scout sees them only after you accept their request.</li>
              <li>We never show your data to the public, and you can switch visibility off or delete videos at any time.</li>
            </ul>
          </div>
        </section>

        <form onSubmit={save} className={`${ui.card} mt-6 space-y-6`}>
          <div>
            <label htmlFor="dob" className={ui.label}>Date of birth *</label>
            <input
              id="dob"
              type="date"
              required
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className={ui.input}
            />
            {age !== null && (
              <p className="mt-2 text-xs text-[#AEB5C0]">
                Age {age}
                {isMinor && " — you'll need a parent or guardian's consent to be visible to scouts."}
              </p>
            )}
          </div>

          <fieldset className="space-y-3">
            <legend className="mb-1 text-sm font-semibold">Visibility to scouts</legend>
            {[
              { value: true, title: "Let scouts find me", text: "Recommended. Scouts can discover your profile and send you requests." },
              { value: false, title: "Keep me hidden for now", text: "Only you can see your profile. You can turn this on later." },
            ].map((o) => (
              <label
                key={String(o.value)}
                className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition ${
                  discoverable === o.value ? "border-[#F47721] bg-[#F47721]/10" : "border-[#454A54]"
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  checked={discoverable === o.value}
                  onChange={() => setDiscoverable(o.value)}
                  className="mt-1 accent-[#F47721]"
                />
                <span>
                  <span className="block font-semibold">{o.title}</span>
                  <span className="block text-sm text-[#AEB5C0]">{o.text}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {discoverable && isMinor && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#F47721]/40 bg-[#F47721]/10 p-4">
              <input
                type="checkbox"
                checked={guardianConsent}
                onChange={(e) => setGuardianConsent(e.target.checked)}
                className="mt-1 h-5 w-5 accent-[#F47721]"
              />
              <span className="text-sm">
                <span className="block font-semibold">Parent or guardian consent *</span>
                My parent or guardian has read this page and agrees that scouts can view my
                profile.
              </span>
            </label>
          )}

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="mt-1 h-5 w-5 accent-[#F47721]"
            />
            <span className="text-sm">I understand what Pata Talanta collects and who can see it.</span>
          </label>

          {error && <p className={ui.error}>{error}</p>}

          <button type="submit" disabled={saving || blocked} className={`${ui.button} w-full`}>
            {saving ? "Saving…" : "Continue to my dashboard"}
          </button>
        </form>
      </div>
    </main>
  );
}
