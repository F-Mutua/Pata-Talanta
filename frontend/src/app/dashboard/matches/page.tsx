"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

type BackendMatch = {
  match_id: string;
  club_name: string | null;
  opponent: string | null;
  competition: string | null;
  match_date: string;
  venue: string | null;
  match_type: string | null;
  team_goals: number | null;
  opponent_goals: number | null;
  match_notes: string | null;
  participation: {
    match_player_id: string | null;
    minutes_played: number | null;
    started: boolean | null;
    position_played: string | null;
  };
  performance_stats: {
    performance_stats_id: string | null;
    goals: number | null;
    assists: number | null;
  } | null;
};

type MatchesResponse = {
  message: string;
  player_id: string;
  total_matches: number;
  matches: BackendMatch[];
};

type SubmitMatchResponse = {
  message: string;
  player_id: string;
  match: {
    match_id: string;
    match_player_id: string;
    performance_stats_id: string;
    status: string;
  };
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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

const emptyStats = Object.fromEntries(
  statFields.map(([key]) => [key, ""])
) as Record<StatKey, string>;

async function getResponseError(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();

    if (
      typeof data === "object" &&
      data !== null &&
      "detail" in data &&
      typeof data.detail === "string"
    ) {
      return data.detail;
    }
  } catch {
    // The response did not contain readable JSON.
  }

  return `Request failed with status ${response.status}.`;
}

export default function MatchesPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

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

  // Retrieve the current Supabase session token.
  const getAccessToken = useCallback(async (): Promise<string> => {
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError) {
      throw authError;
    }

    if (!session) {
      router.push("/login");
      throw new Error("Your session has expired. Please log in again.");
    }

    return session.access_token;
  }, [supabase, router]);

  // Retrieve match history through the FastAPI backend.
  const loadMatches = useCallback(async () => {
    const accessToken = await getAccessToken();

    const response = await fetch(`${API_URL}/matches`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(await getResponseError(response));
    }

    const data: MatchesResponse = await response.json();

    const formattedMatches: Match[] = data.matches.map((match) => ({
      id: match.match_id,
      club_name: match.club_name,
      opponent: match.opponent,
      competition: match.competition,
      match_date: match.match_date,
      venue: match.venue,
      match_type: match.match_type,
      team_goals: match.team_goals,
      opponent_goals: match.opponent_goals,
      notes: match.match_notes,
      minutes_played: match.participation?.minutes_played ?? null,
      match_player_id: match.participation?.match_player_id ?? "",
    }));

    setMatches(formattedMatches);
  }, [getAccessToken]);

  // Load matches when the page opens.
  useEffect(() => {
    let cancelled = false;

    async function fetchMatches() {
      try {
        await loadMatches();
      } catch (err) {
        if (cancelled) return;

        console.error("Match loading error:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Could not load matches."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchMatches();

    return () => {
      cancelled = true;
    };
  }, [loadMatches]);

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
      { name: "Your team's goals", value: teamGoals },
      { name: "Opponent's goals", value: opponentGoals },
      { name: "Minutes played", value: minutesPlayed },
    ];

    for (const [key, label] of statFields) {
      numericFields.push({
        name: label,
        value: stats[key],
      });
    }

    const n = (value: string): number | null =>
      value === "" ? null : Number(value);

    // Validate shots and shots on target.
    const totalShots = Number(stats.shots || 0);
    const shotsOnTarget = Number(stats.shots_on_target || 0);

    if (shotsOnTarget > totalShots) {
      setError("Shots on target cannot be more than total shots.");
      return;
    }

    // Validate completed and attempted passes when both are supplied.
    if (
      n(stats.passes_attempted) !== null &&
      n(stats.passes_completed) !== null &&
      n(stats.passes_completed)! > n(stats.passes_attempted)!
    ) {
      setError(
        "Completed passes cannot be more than attempted passes."
      );
      return;
    }

    // Validate all numeric fields.
    for (const field of numericFields) {
      if (
        field.value !== "" &&
        (!Number.isInteger(Number(field.value)) ||
          Number(field.value) < 0)
      ) {
        setError(
          `${field.name} must be a valid non-negative integer.`
        );
        return;
      }
    }

    if (
      minutesPlayed !== "" &&
      Number(minutesPlayed) > 130
    ) {
      setError("Minutes played cannot exceed 130.");
      return;
    }

    setSaving(true);

    try {
      const accessToken = await getAccessToken();

      // Submit the match and its performance statistics to FastAPI.
      // The backend assigns the authenticated user's ID and saves
      // all related records in one transaction.
      const response = await fetch(`${API_URL}/matches`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
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
          minutes_played:
            minutesPlayed === "" ? 0 : Number(minutesPlayed),
          started: false,
          performance_stats: {
            goals: Number(stats.goals || 0),
            assists: Number(stats.assists || 0),
            shots: Number(stats.shots || 0),
            shots_on_target: Number(stats.shots_on_target || 0),
            passes_completed: n(stats.passes_completed),
            passes_attempted: n(stats.passes_attempted),
            tackles: Number(stats.tackles || 0),
            interceptions: Number(stats.interceptions || 0),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response));
      }

      const result: SubmitMatchResponse = await response.json();

      if (result.match.status !== "submitted") {
        throw new Error(
          "The backend did not confirm the match submission."
        );
      }

      // The backend has confirmed that the match and statistics were saved.
      setSuccess("Match saved successfully!");

      // Clear the form after confirmed submission.
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

      // Refresh match history separately.
      // A refresh failure does not undo the successful submission.
      try {
        await loadMatches();
      } catch (refreshError) {
        console.error(
          "Match history refresh error:",
          refreshError
        );

        setError(
          "Your match was saved, but match history could not refresh. Reload the page to see it."
        );
      }
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
        <Link
          href="/dashboard"
          className="mb-6 inline-block text-sm text-[#F47721] hover:text-[#DB6418]"
        >
          ← Back to Dashboard
        </Link>

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
                  max="130"
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
                Your stats{" "}
                <span className="font-normal text-[#AEB5C0]">
                  (optional)
                </span>
              </legend>

              <p className="mb-3 text-xs text-[#AEB5C0]">
                Leave blank anything you didn&apos;t track. Video analysis
                can add distance, speed and sprints later.
              </p>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {statFields.map(([key, label]) => (
                  <div key={key}>
                    <label
                      htmlFor={`stat-${key}`}
                      className="mb-2 block text-sm text-[#D8DCE2]"
                    >
                      {label}
                    </label>

                    <input
                      id={`stat-${key}`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      value={stats[key]}
                      onChange={(e) =>
                        setStats((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
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
                      {match.team_goals ?? "-"} -{" "}
                      {match.opponent_goals ?? "-"}
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
