
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
  };
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
  const [notes, setNotes] = useState("");

  // Retrieve the current Supabase session token.
  const getAccessToken = useCallback(async (): Promise<string> => {
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError) throw authError;

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

      // Submit the match to FastAPI.
      // The backend assigns the authenticated user's ID
      // and saves related records in one transaction.
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

      // The backend has confirmed that the match was saved.
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
      setNotes("");

      // Refresh match history separately.
      // A refresh failure does not undo the successful submission.
      try {
        await loadMatches();
      } catch (refreshError) {
        console.error("Match history refresh error:", refreshError);

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
    <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/dashboard"
          className="mb-6 inline-block text-sm text-orange-500 hover:text-orange-400"
        >
          ← Back to Dashboard
        </Link>

        <h1 className="text-3xl font-bold">
          Match <span className="text-orange-500">History</span>
        </h1>

        <p className="mt-2 text-gray-400">
          Record your matches and build your football journey.
        </p>

        <section className="mt-8 rounded-xl border border-gray-800 bg-gray-950 p-5 sm:p-7">
          <h2 className="mb-6 text-xl font-semibold">
            Record a Match
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-gray-300">
                  Club represented
                </label>
                <input
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  placeholder="Your club name"
                  className="w-full rounded-lg border border-gray-700 bg-black p-3 text-white outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-300">
                  Opponent *
                </label>
                <input
                  required
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  placeholder="Opponent team"
                  className="w-full rounded-lg border border-gray-700 bg-black p-3 text-white outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-300">
                  Competition
                </label>
                <input
                  value={competition}
                  onChange={(e) => setCompetition(e.target.value)}
                  placeholder="League, tournament, friendly..."
                  className="w-full rounded-lg border border-gray-700 bg-black p-3 text-white outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-300">
                  Match date *
                </label>
                <input
                  required
                  type="date"
                  value={matchDate}
                  onChange={(e) => setMatchDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full rounded-lg border border-gray-700 bg-black p-3 text-white outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-300">
                  Venue
                </label>
                <input
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="Where was the match played?"
                  className="w-full rounded-lg border border-gray-700 bg-black p-3 text-white outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-300">
                  Match type
                </label>
                <select
                  value={matchType}
                  onChange={(e) => setMatchType(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-black p-3 text-white outline-none focus:border-orange-500"
                >
                  <option value="home">Home</option>
                  <option value="away">Away</option>
                  <option value="neutral">Neutral</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-300">
                  Your team&apos;s goals
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={teamGoals}
                  onChange={(e) => setTeamGoals(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-700 bg-black p-3 text-white outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-300">
                  Opponent&apos;s goals
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={opponentGoals}
                  onChange={(e) => setOpponentGoals(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-700 bg-black p-3 text-white outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-300">
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
                  className="w-full rounded-lg border border-gray-700 bg-black p-3 text-white outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-300">
                Match notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Describe your performance or important moments..."
                className="w-full rounded-lg border border-gray-700 bg-black p-3 text-white outline-none focus:border-orange-500"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-300">
                {error}
              </p>
            )}

            {success && (
              <p className="rounded-lg border border-orange-800 bg-orange-950 p-3 text-sm text-orange-300">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-orange-500 px-6 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
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
            <p className="text-gray-400">Loading matches...</p>
          ) : matches.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-950 p-6 text-gray-400">
              No matches recorded yet. Add your first match above.
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map((match) => (
                <article
                  key={match.id}
                  className="rounded-xl border border-gray-800 bg-gray-950 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {match.club_name || "Club not specified"} vs{" "}
                        {match.opponent || "Opponent not specified"}
                      </h3>

                      <p className="mt-1 text-sm text-gray-400">
                        {match.competition || "Competition not specified"}
                      </p>
                    </div>

                    <span className="rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold capitalize text-orange-400">
                      {match.match_type || "Match"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-gray-300 sm:grid-cols-3">
                    <p>
                      <span className="text-gray-500">Date:</span>{" "}
                      {match.match_date}
                    </p>

                    <p>
                      <span className="text-gray-500">Score:</span>{" "}
                      {match.team_goals ?? "-"} - {match.opponent_goals ?? "-"}
                    </p>

                    <p>
                      <span className="text-gray-500">Minutes:</span>{" "}
                      {match.minutes_played ?? "-"}
                    </p>
                  </div>

                  {match.venue && (
                    <p className="mt-3 text-sm text-gray-400">
                      Venue: {match.venue}
                    </p>
                  )}

                  {match.notes && (
                    <p className="mt-3 text-sm text-gray-400">
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
