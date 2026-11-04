
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Club = {
  id: string;
  club_name: string;
  league_or_division: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  achievement: string | null;
  notes: string | null;
};

export default function ClubsPage() {
  const supabase = createClient();

  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [clubName, setClubName] = useState("");
  const [league, setLeague] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(true);
  const [achievement, setAchievement] = useState("");
  const [notes, setNotes] = useState("");

  async function loadClubs() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("player_club_history")
      .select("*")
      .eq("player_id", user.id)
      .order("start_date", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setClubs(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadClubs();
  }, []);

  async function addClub(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { error } = await supabase
      .from("player_club_history")
      .insert({
        player_id: user.id,
        club_name: clubName.trim(),
        league_or_division: league.trim() || null,
        start_date: startDate || null,
        end_date: isCurrent ? null : endDate || null,
        is_current: isCurrent,
        achievement: achievement.trim() || null,
        notes: notes.trim() || null,
      });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Club history added successfully.");

      setClubName("");
      setLeague("");
      setStartDate("");
      setEndDate("");
      setIsCurrent(true);
      setAchievement("");
      setNotes("");

      await loadClubs();
    }

    setSaving(false);
  }

  return (
    <main className="text-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#F47721]">
          Player career
        </p>

        <h1 className="mt-3 text-4xl font-black">My Club History</h1>

        <p className="mt-4 max-w-2xl leading-7 text-[#AEB5C0]">
          Document the clubs you have represented. This helps scouts
          understand your football journey and experience.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <section className="h-fit rounded-xl border border-[#353941] bg-[#22252B] p-6">
            <h2 className="text-xl font-bold">Add a club</h2>

            <form onSubmit={addClub} className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm text-[#AEB5C0]">
                  Club name *
                </label>
                <input
                  required
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  placeholder="Enter club name"
                  className="w-full rounded-lg border border-[#454A54] bg-[#17191D] px-4 py-3 outline-none focus:border-[#F47721]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-[#AEB5C0]">
                  League or division
                </label>
                <input
                  value={league}
                  onChange={(e) => setLeague(e.target.value)}
                  placeholder="e.g. FKF Division One"
                  className="w-full rounded-lg border border-[#454A54] bg-[#17191D] px-4 py-3 outline-none focus:border-[#F47721]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-[#AEB5C0]">
                  Start date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-[#454A54] bg-[#17191D] px-4 py-3 outline-none focus:border-[#F47721]"
                />
              </div>

              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={isCurrent}
                  onChange={(e) => setIsCurrent(e.target.checked)}
                  className="accent-[#F47721]"
                />
                I currently play for this club
              </label>

              {!isCurrent && (
                <div>
                  <label className="mb-2 block text-sm text-[#AEB5C0]">
                    End date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border border-[#454A54] bg-[#17191D] px-4 py-3 outline-none focus:border-[#F47721]"
                  />
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm text-[#AEB5C0]">
                  Achievement
                </label>
                <input
                  value={achievement}
                  onChange={(e) => setAchievement(e.target.value)}
                  placeholder="e.g. County champions"
                  className="w-full rounded-lg border border-[#454A54] bg-[#17191D] px-4 py-3 outline-none focus:border-[#F47721]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-[#AEB5C0]">
                  Additional notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Add relevant details about your time at this club"
                  className="w-full rounded-lg border border-[#454A54] bg-[#17191D] px-4 py-3 outline-none focus:border-[#F47721]"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              {message && (
                <p className="text-sm text-green-400">{message}</p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-[#F47721] px-6 py-3 font-bold text-white transition hover:bg-[#DB6418] disabled:opacity-50"
              >
                {saving ? "Saving..." : "Add club to my history"}
              </button>
            </form>
          </section>

          <section>
            <h2 className="text-xl font-bold">My football journey</h2>

            {loading ? (
              <p className="mt-6 text-[#AEB5C0]">Loading club history...</p>
            ) : clubs.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-[#454A54] p-8 text-center">
                <p className="font-semibold">No clubs added yet</p>
                <p className="mt-2 text-sm text-[#AEB5C0]">
                  Add your current or previous club to start building
                  your football history.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {clubs.map((club) => (
                  <article
                    key={club.id}
                    className="rounded-xl border border-[#353941] bg-[#22252B] p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-bold">
                          {club.club_name}
                        </h3>
                        <p className="mt-1 text-sm text-[#AEB5C0]">
                          {club.league_or_division || "League not specified"}
                        </p>
                      </div>

                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                        club.is_current
                          ? "bg-[#F47721]/15 text-[#F47721]"
                          : "bg-[#454A54] text-[#D1D5DB]"
                      }`}>
                        {club.is_current ? "CURRENT CLUB" : "FORMER CLUB"}
                      </span>
                    </div>

                    <p className="mt-4 text-sm text-[#AEB5C0]">
                      {club.start_date || "Start date not provided"}
                      {" — "}
                      {club.is_current
                        ? "Present"
                        : club.end_date || "End date not provided"}
                    </p>

                    {club.achievement && (
                      <p className="mt-4 text-sm">
                        <span className="font-semibold text-[#F47721]">
                          Achievement:{" "}
                        </span>
                        {club.achievement}
                      </p>
                    )}

                    {club.notes && (
                      <p className="mt-3 text-sm leading-6 text-[#AEB5C0]">
                        {club.notes}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
