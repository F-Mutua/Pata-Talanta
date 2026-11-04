
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

      const { error: appearanceError } = await supabase
        .from("match_players")
        .insert({
          match_id: newMatch.id,
          player_id: user.id,
          minutes_played:
            minutesPlayed === "" ? null : Number(minutesPlayed),
        });

      if (appearanceError) {
        console.error("Appearance registration error:", appearanceError);

        setError(
          `The match was created, but the player appearance could not be registered: ${appearanceError.message}. Please check before trying again.`
        );

        await loadMatches();
        return;
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
    <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">

        <a
          href="/dashboard"
          className="mb-6 inline-block text-sm text-orange-500 hover:text-orange-400"
        >
          ← Back to Dashboard
        </a>

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
                  Your team's goals
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
                  Opponent's goals
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
            <p className="text-gray-400">
              Loading matches...
            </p>
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
