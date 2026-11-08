"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { ui, formatDate, errorMessage } from "@/lib/ui";
import { ageFrom } from "@/lib/types";

export default function PlayerProfilePage() {
  const [displayName, setDisplayName] = useState("");
  const [county, setCounty] = useState("");
  const [position, setPosition] = useState("");
  const [dob, setDob] = useState("");
  const [discoverable, setDiscoverable] = useState(false);
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [consentAt, setConsentAt] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [views, setViews] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        window.location.href = "/login";
        return;
      }

      const [{ data, error: profileError }, { data: contact }, { count }] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, county, position, date_of_birth, discoverable, guardian_consent, consent_at")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("player_contacts")
          .select("phone, contact_email")
          .eq("player_id", user.id)
          .maybeSingle(),
        supabase
          .from("profile_views")
          .select("id", { count: "exact", head: true })
          .eq("player_id", user.id),
      ]);

      if (profileError) {
        setError(profileError.message);
      } else if (data) {
        setDisplayName(data.display_name || "");
        setCounty(data.county || "");
        setPosition(data.position || "");
        setDob(data.date_of_birth || "");
        setDiscoverable(!!data.discoverable);
        setGuardianConsent(!!data.guardian_consent);
        setConsentAt(data.consent_at);
      } else {
        setError("Your player profile could not be found.");
      }
      setPhone(contact?.phone || "");
      setContactEmail(contact?.contact_email || "");
      setViews(count ?? null);
      setLoading(false);
    })();
  }, []);

  const age = ageFrom(dob);
  const isMinor = age !== null && age < 18;
  const needsGuardian = discoverable && isMinor && !guardianConsent;

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (discoverable && !dob) {
      return setError("Add your date of birth before making your profile visible to scouts.");
    }
    if (needsGuardian) {
      return setError(
        "Players under 18 need a parent or guardian's consent before scouts can find them."
      );
    }
    const trimmedEmail = contactEmail.trim();
    if (trimmedEmail && !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      return setError("Please enter a valid contact email.");
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Your session has expired. Please sign in again.");

      const now = new Date().toISOString();
      // Record when consent was first given; clear it when withdrawn.
      const newConsentAt = discoverable ? consentAt || now : null;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          county: county.trim(),
          position: position.trim(),
          date_of_birth: dob || null,
          discoverable,
          guardian_consent: isMinor ? guardianConsent : false,
          consent_at: newConsentAt,
          updated_at: now,
        })
        .eq("id", user.id);
      if (updateError) throw updateError;

      const { error: contactError } = await supabase.from("player_contacts").upsert(
        {
          player_id: user.id,
          phone: phone.trim() || null,
          contact_email: trimmedEmail || null,
          updated_at: now,
        },
        { onConflict: "player_id" }
      );
      if (contactError) throw contactError;

      setConsentAt(newConsentAt);
      setMessage("Your player profile has been updated.");
    } catch (err) {
      setError(errorMessage(err, "Something went wrong. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="p-10 text-white">Loading your player profile…</main>;
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <p className={ui.eyebrow}>Player information</p>
        <h1 className={ui.h1}>My Player Profile</h1>
        <p className="mt-4 leading-7 text-[#AEB5C0]">
          Tell scouts who you are, where you come from and where you play on the pitch.
        </p>

        <form onSubmit={handleSave} className="mt-10 space-y-8">
          <section className={`${ui.card} space-y-6 p-8`}>
            <h2 className="text-xl font-bold">About you</h2>
            <div>
              <label htmlFor="displayName" className={ui.label}>Full name</label>
              <input
                id="displayName"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={ui.input}
                placeholder="Enter your full name"
              />
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="dob" className={ui.label}>Date of birth</label>
                <input
                  id="dob"
                  type="date"
                  max={today}
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className={ui.input}
                />
                {age !== null && <p className="mt-2 text-xs text-[#AEB5C0]">Age {age}</p>}
              </div>
              <div>
                <label htmlFor="county" className={ui.label}>County</label>
                <input
                  id="county"
                  value={county}
                  onChange={(e) => setCounty(e.target.value)}
                  className={ui.input}
                  placeholder="e.g. Nairobi, Makueni, Kiambu"
                />
              </div>
            </div>
            <div>
              <label htmlFor="position" className={ui.label}>Preferred playing position</label>
              <input
                id="position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className={ui.input}
                placeholder="e.g. Striker, Goalkeeper, Midfielder"
              />
            </div>
          </section>

          <section className={`${ui.card} space-y-5 p-8`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Visibility to scouts</h2>
                <p className="mt-1 text-sm text-[#AEB5C0]">
                  Only scouts registered on Pata Talanta can see visible profiles. You can turn
                  this off at any time.
                </p>
              </div>
              {views !== null && discoverable && (
                <span className="rounded-full bg-[#F47721]/15 px-3 py-1 text-xs font-bold text-[#F47721]">
                  Viewed {views} time{views === 1 ? "" : "s"} by scouts
                </span>
              )}
            </div>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={discoverable}
                onChange={(e) => setDiscoverable(e.target.checked)}
                className="mt-1 h-5 w-5 accent-[#F47721]"
              />
              <span>
                <span className="block font-semibold">Let scouts find me</span>
                <span className="block text-sm text-[#AEB5C0]">
                  Scouts can see your profile, club history, matches and statistics. Your
                  contact details stay hidden until you accept a scout&apos;s request.
                </span>
              </span>
            </label>

            {discoverable && isMinor && (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#F47721]/40 bg-[#F47721]/10 p-4">
                <input
                  type="checkbox"
                  checked={guardianConsent}
                  onChange={(e) => setGuardianConsent(e.target.checked)}
                  className="mt-1 h-5 w-5 accent-[#F47721]"
                />
                <span className="text-sm">
                  <span className="block font-semibold">Parent or guardian consent</span>
                  Because you are under 18, a parent or guardian must agree. Tick this box
                  together with them to confirm they consent to scouts viewing your profile.
                </span>
              </label>
            )}

            {consentAt && discoverable && (
              <p className="text-xs text-[#AEB5C0]">Visible to scouts since {formatDate(consentAt)}.</p>
            )}
          </section>

          <section id="contact" className={`${ui.card} scroll-mt-6 space-y-6 p-8`}>
            <div>
              <h2 className="text-xl font-bold">Contact details</h2>
              <p className="mt-1 text-sm text-[#AEB5C0]">
                Private. A scout only sees these after you accept their request.
                {isMinor && " You can use a parent or guardian's number."}
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="phone" className={ui.label}>Phone</label>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={ui.input}
                  placeholder="e.g. 0712 345 678"
                />
              </div>
              <div>
                <label htmlFor="contactEmail" className={ui.label}>Email</label>
                <input
                  id="contactEmail"
                  type="email"
                  autoComplete="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className={ui.input}
                  placeholder="you@example.com"
                />
              </div>
            </div>
          </section>

          {error && <p className={ui.error}>{error}</p>}
          {message && <p className={ui.success}>{message}</p>}

          <button type="submit" disabled={saving || needsGuardian} className={`${ui.button} w-full`}>
            {saving ? "Saving…" : "Save player profile"}
          </button>
        </form>
      </div>
    </main>
  );
}
