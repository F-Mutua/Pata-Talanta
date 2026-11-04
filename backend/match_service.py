from backend.database import user_database_connection
from backend.schemas import MatchSubmission


def submit_player_match(user_id: str, match_data: MatchSubmission):
    """
    Save a player's match, participation and performance
    statistics in one database transaction.

    All ownership IDs are assigned by the backend.
    """

    stats = match_data.performance_stats

    with user_database_connection(user_id) as conn:

        # 1. Create the match.
        match = conn.execute(
            """
            INSERT INTO public.matches (
                created_by,
                club_name,
                opponent,
                competition,
                match_date,
                venue,
                match_type,
                team_goals,
                opponent_goals,
                notes
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                user_id,
                match_data.club_name,
                match_data.opponent,
                match_data.competition,
                match_data.match_date,
                match_data.venue,
                match_data.match_type,
                match_data.team_goals,
                match_data.opponent_goals,
                match_data.notes
            )
        ).fetchone()

        match_id = match[0]

        # 2. Record the authenticated player's participation.
        participation = conn.execute(
            """
            INSERT INTO public.match_players (
                match_id,
                player_id,
                minutes_played,
                started,
                position_played
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                match_id,
                user_id,
                match_data.minutes_played,
                match_data.started,
                match_data.position_played
            )
        ).fetchone()

        match_player_id = participation[0]

        # 3. Save the player's performance statistics.
        stats_record = conn.execute(
            """
            INSERT INTO public.performance_stats (
                match_player_id,
                goals,
                assists,
                shots,
                shots_on_target,
                tackles,
                interceptions,
                passes_completed,
                passes_attempted,
                distance_km,
                top_speed_kmh,
                sprint_count,
                touches,
                data_source,
                notes
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s
            )
            RETURNING id
            """,
            (
                match_player_id,
                stats.goals,
                stats.assists,
                stats.shots,
                stats.shots_on_target,
                stats.tackles,
                stats.interceptions,
                stats.passes_completed,
                stats.passes_attempted,
                stats.distance_km,
                stats.top_speed_kmh,
                stats.sprint_count,
                stats.touches,
                "manual",
                stats.notes
            )
        ).fetchone()

        performance_stats_id = stats_record[0]

        return {
            "match_id": str(match_id),
            "match_player_id": str(match_player_id),
            "performance_stats_id": str(performance_stats_id),
            "status": "submitted"
        }


def get_player_matches(user_id: str):
    """
    Retrieve the authenticated player's match history,
    participation details and performance statistics.

    RLS is applied through user_database_connection().
    """

    with user_database_connection(user_id) as conn:

        rows = conn.execute(
            """
            SELECT
                m.id AS match_id,
                m.club_name,
                m.opponent,
                m.competition,
                m.match_date,
                m.venue,
                m.match_type,
                m.team_goals,
                m.opponent_goals,
                m.notes AS match_notes,
                m.created_at,

                mp.id AS match_player_id,
                mp.minutes_played,
                mp.started,
                mp.position_played,

                ps.id AS performance_stats_id,
                ps.goals,
                ps.assists,
                ps.shots,
                ps.shots_on_target,
                ps.tackles,
                ps.interceptions,
                ps.passes_completed,
                ps.passes_attempted,
                ps.distance_km::double precision AS distance_km,
                ps.top_speed_kmh::double precision AS top_speed_kmh,
                ps.sprint_count,
                ps.touches,
                ps.data_source,
                ps.notes AS performance_notes

            FROM public.matches AS m

            LEFT JOIN public.match_players AS mp
                ON mp.match_id = m.id

            LEFT JOIN public.performance_stats AS ps
                ON ps.match_player_id = mp.id

            WHERE m.created_by = %s

            ORDER BY
                m.match_date DESC,
                m.created_at DESC
            """,
            (user_id,)
        ).fetchall()

        matches = []

        for row in rows:

            matches.append({
                "match_id": str(row[0]),
                "club_name": row[1],
                "opponent": row[2],
                "competition": row[3],
                "match_date": row[4],
                "venue": row[5],
                "match_type": row[6],
                "team_goals": row[7],
                "opponent_goals": row[8],
                "match_notes": row[9],
                "created_at": row[10],

                "participation": {
                    "match_player_id": (
                        str(row[11]) if row[11] else None
                    ),
                    "minutes_played": row[12],
                    "started": row[13],
                    "position_played": row[14]
                },

                "performance_stats": {
                    "performance_stats_id": (
                        str(row[15]) if row[15] else None
                    ),
                    "goals": row[16],
                    "assists": row[17],
                    "shots": row[18],
                    "shots_on_target": row[19],
                    "tackles": row[20],
                    "interceptions": row[21],
                    "passes_completed": row[22],
                    "passes_attempted": row[23],
                    "distance_km": row[24],
                    "top_speed_kmh": row[25],
                    "sprint_count": row[26],
                    "touches": row[27],
                    "data_source": row[28],
                    "notes": row[29]
                }
            })

        return matches
