
from backend.database import user_database_connection


# =====================================================
# 1. DATABASE RESULT CONVERSION
# =====================================================

def serialize_assessment(cursor, row):
    """Convert a database row into a JSON-ready dictionary."""

    if row is None:
        return None

    column_names = [
        column.name
        for column in cursor.description
    ]

    result = dict(zip(column_names, row))

    for field in [
        "id",
        "scout_id",
        "player_id",
        "match_id",
    ]:
        if result[field] is not None:
            result[field] = str(result[field])

    return result


# =====================================================
# 2. CREATE ASSESSMENT
# =====================================================

def create_player_assessment(user_id: str, assessment_data):
    """
    Create an assessment.

    The scout ID always comes from the authenticated user,
    never from frontend input.
    """

    with user_database_connection(user_id) as conn:

        cursor = conn.execute(
            """
            INSERT INTO public.player_scout_assessments (
                scout_id,
                player_id,
                match_id,
                technical_rating,
                tactical_rating,
                decision_making_rating,
                strengths,
                development_areas,
                overall_assessment,
                recommendation
            )
            VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s
            )
            RETURNING
                id::text AS id,
                scout_id::text AS scout_id,
                player_id::text AS player_id,
                match_id::text AS match_id,
                technical_rating,
                tactical_rating,
                decision_making_rating,
                strengths,
                development_areas,
                overall_assessment,
                recommendation,
                created_at,
                updated_at
            """,
            (
                user_id,
                str(assessment_data.player_id),
                (
                    str(assessment_data.match_id)
                    if assessment_data.match_id
                    else None
                ),
                assessment_data.technical_rating,
                assessment_data.tactical_rating,
                assessment_data.decision_making_rating,
                assessment_data.strengths,
                assessment_data.development_areas,
                assessment_data.overall_assessment,
                assessment_data.recommendation,
            )
        )

        row = cursor.fetchone()

        return serialize_assessment(cursor, row)


# =====================================================
# 3. RETRIEVE ASSESSMENTS
# =====================================================

def get_player_assessments(user_id: str):
    """
    Retrieve assessments visible to the authenticated user.

    RLS determines whether the user is the scout or
    the player being assessed.
    """

    with user_database_connection(user_id) as conn:

        cursor = conn.execute(
            """
            SELECT
                id::text AS id,
                scout_id::text AS scout_id,
                player_id::text AS player_id,
                match_id::text AS match_id,
                technical_rating,
                tactical_rating,
                decision_making_rating,
                strengths,
                development_areas,
                overall_assessment,
                recommendation,
                created_at,
                updated_at

            FROM public.player_scout_assessments

            WHERE scout_id = %s
               OR player_id = %s

            ORDER BY created_at DESC
            """,
            (user_id, user_id)
        )

        rows = cursor.fetchall()

        return [
            serialize_assessment(cursor, row)
            for row in rows
        ]


# =====================================================
# 4. RETRIEVE ONE ASSESSMENT
# =====================================================

def get_player_assessment(user_id: str, assessment_id: str):
    """
    Retrieve one assessment.

    RLS prevents access to unrelated assessments.
    """

    with user_database_connection(user_id) as conn:

        cursor = conn.execute(
            """
            SELECT
                id::text AS id,
                scout_id::text AS scout_id,
                player_id::text AS player_id,
                match_id::text AS match_id,
                technical_rating,
                tactical_rating,
                decision_making_rating,
                strengths,
                development_areas,
                overall_assessment,
                recommendation,
                created_at,
                updated_at

            FROM public.player_scout_assessments

            WHERE id = %s
            """,
            (assessment_id,)
        )

        row = cursor.fetchone()

        return serialize_assessment(cursor, row)


# =====================================================
# 5. UPDATE ASSESSMENT
# =====================================================

def update_player_assessment(
    user_id: str,
    assessment_id: str,
    update_data: dict
):
    """
    Update permitted assessment fields.

    Identity and ownership fields cannot be changed.
    """

    allowed_fields = {
        "technical_rating",
        "tactical_rating",
        "decision_making_rating",
        "strengths",
        "development_areas",
        "overall_assessment",
        "recommendation",
    }

    fields = {
        key: value
        for key, value in update_data.items()
        if key in allowed_fields
    }

    if not fields:
        raise ValueError(
            "No valid assessment fields were supplied."
        )

    # Column names are restricted to the allowlist above.
    set_clause = ", ".join(
        f"{field} = %s"
        for field in fields
    )

    values = list(fields.values())
    values.append(assessment_id)

    with user_database_connection(user_id) as conn:

        cursor = conn.execute(
            f"""
            UPDATE public.player_scout_assessments

            SET {set_clause}

            WHERE id = %s

            RETURNING
                id::text AS id,
                scout_id::text AS scout_id,
                player_id::text AS player_id,
                match_id::text AS match_id,
                technical_rating,
                tactical_rating,
                decision_making_rating,
                strengths,
                development_areas,
                overall_assessment,
                recommendation,
                created_at,
                updated_at
            """,
            values
        )

        row = cursor.fetchone()

        return serialize_assessment(cursor, row)


# =====================================================
# 6. DELETE ASSESSMENT
# =====================================================

def delete_player_assessment(
    user_id: str,
    assessment_id: str
):
    """
    Delete an assessment owned by the authenticated scout.

    RLS determines whether deletion is permitted.
    """

    with user_database_connection(user_id) as conn:

        cursor = conn.execute(
            """
            DELETE FROM public.player_scout_assessments

            WHERE id = %s

            RETURNING id::text
            """,
            (assessment_id,)
        )

        row = cursor.fetchone()

        return row[0] if row else None
