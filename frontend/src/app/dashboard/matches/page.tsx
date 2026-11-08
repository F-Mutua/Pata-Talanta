
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Match = {
  id: string;
  club_name: string | null;
  opponent: string | null;
  competition: string | null;
  match_date: string;
  venue: string | null;
  match_type: string | null;
  team_goals: number | null;
  opponent_goals: number | null;
  notes: string | null;
  minutes_played: number | null;
  match_player_id: string;
};

type MatchPlayer = {
  id: string;
  match_id: string;
  player_id: string;
  minutes_played: number | null;
};

const statFields = [
  ["goals", "Goals"],
  ["assists", "Assists"],
  ["shots", "Shots"],
  ["shots_on_target", "Shots on target"],
  ["passes_completed", "Passes completed"],
  ["passes_attempted", "Passes attempted"],
  ["tackles", "Tackles"],
  ["interceptions", "Interceptions"],
] as const;

type StatKey = (typeof statFields)[number][0];

const emptyStats = Object.fromEntries(statFields.map(([k]) => [k, ""])) as Record<StatKey, string>;

export default function MatchesPage() {
  const supabase = createClient();

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [clubName, setClubName] = useState("");
  const [opponent, setOpponent] = useState("");
  const [competition, setCompetition] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [venue, setVenue] = useState("");
  const [matchType, setMatchType] = useState("home");
  const [teamGoals, setTeamGoals] = useState("");
  const [opponentGoals, setOpponentGoals] = useState("");
  const [minutesPlayed, setMinutesPlayed] = useState("");
  const [stats, setStats] = useState<Record<StatKey, string>>(emptyStats);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMatches() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        window.location.href = "/login";
        return;
      }

      // 1. Get this player's match appearances.
      const { data: playerMatches, error: playerError } =
        await supabase
          .from("match_players")
          .select("id, match_id, player_id, minutes_played")
          .eq("player_id", user.id);

      if (playerError) throw playerError;

      const appearances = (playerMatches || []) as MatchPlayer[];

      if (appearances.length === 0) {
        setMatches([]);
        return;
      }

      // 2. Get the match IDs.
      const matchIds = [
        ...new Set(appearances.map((item) => item.match_id)),
      ];

      // 3. Retrieve matches using their actual IDs.
      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select(
          "id, club_name, opponent, competition, match_date, venue, match_type, team_goals, opponent_goals, notes"
        )
        .in("id", matchIds)
        .order("match_date", { ascending: false });

      if (matchError) throw matchError;

      // 4. Combine matches with the player's appearance information.
      const appearanceMap = new Map(
        appearances.map((item) => [item.match_id, item])
      );

      const combined: Match[] = (matchData || []).map((match) => {
        const appearance = appearanceMap.get(match.id);

        return {
          ...match,
          minutes_played: appearance?.minutes_played ?? null,
          match_player_id: appearance?.id ?? "",
        };
      });

      setMatches(combined);
    } catch (err) {
      console.error("Match loading error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not load matches."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!opponent.trim() || !matchDate) {
      setError("Please enter the opponent and match date.");
      return;
    }

    const allowedMatchTypes = ["home", "away", "neutral"];

    if (!allowedMatchTypes.includes(matchType)) {
      setError("Please select a valid match type.");
      return;
    }

    const numericFields = [
      { name: "Your team&apos;s goals", value: teamGoals },
      { name: "Opponent&apos;s goals", value: opponentGoals },
      { name: "Minutes played", value: minutesPlayed },
    ];

    for (const [key, label] of statFields) {
      numericFields.push({ name: label, value: stats[key] });
    }

    const n = (v: string) => (v === "" ? null : Number(v));
    if (n(stats.shots) !== null && n(stats.shots_on_target) !== null && n(stats.shots_on_target)! > n(stats.shots)!) {
      setError("Shots on target cannot be more than total shots.");
      return;
    }
    if (
      n(stats.passes_attempted) !== null &&
      n(stats.passes_completed) !== null &&
      n(stats.passes_completed)! > n(stats.passes_attempted)!
    ) {
      setError("Completed passes cannot be more than attempted passes.");
      return;
    }

    for (const field of numericFields) {
      if (
        field.value !== "" &&
        (!Number.isInteger(Number(field.value)) ||
          Number(field.value) < 0)
      ) {
        setError(`${field.name} must be a valid non-negative integer.`);
        return;
      }
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        setError("Your session has expired. Please log in again.");
        return;
      }

      // 1. Insert the match into the matches table.
      // matches uses created_by, NOT player_id.

      const { data: newMatch, error: insertError } = await supabase
        .from("matches")
        .insert({
          created_by: user.id,
          club_name: clubName.trim() || null,
          opponent: opponent.trim(),
          competition: competition.trim() || null,
          match_date: matchDate,
          venue: venue.trim() || null,
          match_type: matchType,
          team_goals:
            teamGoals === "" ? null : Number(teamGoals),
          opponent_goals:
            opponentGoals === "" ? null : Number(opponentGoals),
          notes: notes.trim() || null,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      // 2. Register the player's appearance separately.
      // minutes_played belongs to match_players.

      const { data: appearance, error: appearanceError } = await supabase
        .from("match_players")
        .insert({
          match_id: newMatch.id,
          player_id: user.id,
          minutes_played:
            minutesPlayed === "" ? null : Number(minutesPlayed),
        })
        .select("id")
        .single();

      if (appearanceError) {
        console.error("Appearance registration error:", appearanceError);

        setError(
          `The match was created, but the player appearance could not be registered: ${appearanceError.message}. Please check before trying again.`
        );

        await loadMatches();
        return;
      }

      // Optional stats go to performance_stats for this appearance.
      if (statFields.some(([k]) => stats[k] !== "")) {
        const { error: statsError } = await supabase.from("performance_stats").insert({
          match_player_id: appearance.id,
          ...Object.fromEntries(statFields.map(([k]) => [k, n(stats[k])])),
          data_source: "player_entry",
        });
        if (statsError) {
          setError(
            `The match was saved, but your stats could not be: ${statsError.message}. You can add them on the Performance page.`
          );
          await loadMatches();
          return;
        }
      }

      setSuccess("Match saved successfully!");

      // Reset the form.
      setClubName("");
      setOpponent("");
      setCompetition("");
      setMatchDate("");
      setVenue("");
      setMatchType("home");
      setTeamGoals("");
      setOpponentGoals("");
      setMinutesPlayed("");
      setStats(emptyStats);
      setNotes("");

      await loadMatches();
    } catch (err) {
      console.error("Match saving error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not save the match."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="px-4 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">

        <a
          href="/dashboard"
          className="mb-6 inline-block text-sm text-[#F47721] hover:text-[#DB6418]"
        >
          ← Back to Dashboard
        </a>

        <h1 className="text-3xl font-bold">
          Match <span className="text-[#F47721]">History</span>
        </h1>

        <p className="mt-2 text-[#AEB5C0]">
          Record your matches and build your football journey.
        </p>

        <section className="mt-8 rounded-xl border border-[#353941] bg-[#22252B] p-5 sm:p-7">

          <h2 className="mb-6 text-xl font-semibold">
            Record a Match
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">

            <div className="grid gap-5 sm:grid-cols-2">

              <div>
                <label className="mb-2 block text-sm text-[#D8DCE2]">
                  Club represented
                </label>
                <input
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  placeholder="Your club name"
                  className="w-full rounded-lg border border-[#454A54] bg-[#17191D] p-3 text-white outline-none focus:border-[#F47721]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-[#D8DCE2]">
                  Opponent *
                </label>
                <input
                  required
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  placeholder="Opponent team"
                  className="w-full rounded-lg border border-[#454A54] bg-[#17191D] p-3 text-white outline-none focus:border-[#F47721]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-[#D8DCE2]">
                  Competition
                </label>
                <input
                  value={competition}
                  onChange={(e) => setCompetition(e.target.value)}
                  placeholder="League, tournament, friendly..."
                  className="w-full rounded-lg border border-[#454A54] bg-[#17191D] p-3 text-white outline-none focus:border-[#F47721]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-[#D8DCE2]">
                  Match date *
                </label>
                <input
                  required
                  type="date"
                  value={matchDate}
                  onChange={(e) => setMatchDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full rounded-lg border border-[#454A54] bg-[#17191D] p-3 text-white outline-none focus:border-[#F47721]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-[#D8DCE2]">
                  Venue
                </label>
                <input
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="Where was the match played?"
                  className="w-full rounded-lg border border-[#454A54] bg-[#17191D] p-3 text-white outline-none focus:border-[#F47721]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-[#D8DCE2]">
                  Match type
                </label>
                <select
                  value={matchType}
                  onChange={(e) => setMatchType(e.target.value)}
                  className="w-full rounded-lg border border-[#454A54] bg-[#17191D] p-3 text-white outline-none focus:border-[#F47721]"
                >
                  <option value="home">Home</option>
                  <option value="away">Away</option>
                  <option value="neutral">Neutral</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-[#D8DCE2]">
                  Your team&apos;s goals
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={teamGoals}
                  onChange={(e) => setTeamGoals(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-[#454A54] bg-[#17191D] p-3 text-white outline-none focus:border-[#F47721]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-[#D8DCE2]">
                  Opponent&apos;s goals
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={opponentGoals}
                  onChange={(e) => setOpponentGoals(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-[#454A54] bg-[#17191D] p-3 text-white outline-none focus:border-[#F47721]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-[#D8DCE2]">
                  Minutes played
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={minutesPlayed}
                  onChange={(e) => setMinutesPlayed(e.target.value)}
                  placeholder="90"
                  className="w-full rounded-lg border border-[#454A54] bg-[#17191D] p-3 text-white outline-none focus:border-[#F47721]"
                />
              </div>

            </div>

            <fieldset>
              <legend className="mb-1 text-sm font-semibold text-white">
                Your stats <span className="font-normal text-[#AEB5C0]">(optional)</span>
              </legend>
              <p className="mb-3 text-xs text-[#AEB5C0]">
                Leave blank anything you didn&apos;t track. Video analysis can add distance,
                speed and sprints later.
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {statFields.map(([key, label]) => (
                  <div key={key}>
                    <label htmlFor={`stat-${key}`} className="mb-2 block text-sm text-[#D8DCE2]">
                      {label}
                    </label>
                    <input
                      id={`stat-${key}`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      value={stats[key]}
                      onChange={(e) => setStats((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder="0"
                      className="w-full rounded-lg border border-[#454A54] bg-[#17191D] p-3 text-white outline-none focus:border-[#F47721]"
                    />
                  </div>
                ))}
              </div>
            </fieldset>

            <div>
              <label className="mb-2 block text-sm text-[#D8DCE2]">
                Match notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Describe your performance or important moments..."
                className="w-full rounded-lg border border-[#454A54] bg-[#17191D] p-3 text-white outline-none focus:border-[#F47721]"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </p>
            )}

            {success && (
              <p className="rounded-lg border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#F47721] px-6 py-3 font-bold text-white transition hover:bg-[#DB6418] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Match"}
            </button>

          </form>
        </section>

        <section className="mt-10">

          <h2 className="mb-5 text-xl font-semibold">
            My Matches
          </h2>

          {loading ? (
            <p className="text-[#AEB5C0]">
              Loading matches...
            </p>
          ) : matches.length === 0 ? (
            <div className="rounded-xl border border-[#353941] bg-[#22252B] p-6 text-[#AEB5C0]">
              No matches recorded yet. Add your first match above.
            </div>
          ) : (
            <div className="space-y-4">

              {matches.map((match) => (
                <article
                  key={match.id}
                  className="rounded-xl border border-[#353941] bg-[#22252B] p-5"
                >

                  <div className="flex flex-wrap items-start justify-between gap-3">

                    <div>
                      <h3 className="text-lg font-semibold">
                        {match.club_name || "Club not specified"} vs{" "}
                        {match.opponent || "Opponent not specified"}
                      </h3>

                      <p className="mt-1 text-sm text-[#AEB5C0]">
                        {match.competition || "Competition not specified"}
                      </p>
                    </div>

                    <span className="rounded-full bg-[#F47721]/15 px-3 py-1 text-xs font-semibold capitalize text-[#F47721]">
                      {match.match_type || "Match"}
                    </span>

                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-[#D8DCE2] sm:grid-cols-3">

                    <p>
                      <span className="text-[#AEB5C0]">Date:</span>{" "}
                      {match.match_date}
                    </p>

                    <p>
                      <span className="text-[#AEB5C0]">Score:</span>{" "}
                      {match.team_goals ?? "-"} - {match.opponent_goals ?? "-"}
                    </p>

                    <p>
                      <span className="text-[#AEB5C0]">Minutes:</span>{" "}
                      {match.minutes_played ?? "-"}
                    </p>

                  </div>

                  {match.venue && (
                    <p className="mt-3 text-sm text-[#AEB5C0]">
                      Venue: {match.venue}
                    </p>
                  )}

                  {match.notes && (
                    <p className="mt-3 text-sm text-[#AEB5C0]">
                      {match.notes}
                    </p>
                  )}

                </article>
              ))}

            </div>
          )}

        </section>

      </div>
    </main>
  );
}
