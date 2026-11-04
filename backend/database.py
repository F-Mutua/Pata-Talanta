import json
from contextlib import contextmanager

import psycopg

from backend.config import DATABASE_URL


@contextmanager
def user_database_connection(user_id: str):
    """
    Open a database transaction using the authenticated
    player's identity so that RLS policies are enforced.
    """

    with psycopg.connect(DATABASE_URL) as conn:

        with conn.transaction():

            # Assume the authenticated database role.
            conn.execute("SET LOCAL ROLE authenticated")

            # Set the verified user's identity for RLS.
            claims = {
                "sub": str(user_id),
                "role": "authenticated",
                "aud": "authenticated"
            }

            conn.execute(
                """
                SELECT set_config(
                    'request.jwt.claim.sub',
                    %s,
                    true
                )
                """,
                (str(user_id),)
            )

            conn.execute(
                """
                SELECT set_config(
                    'request.jwt.claim.role',
                    'authenticated',
                    true
                )
                """
            )

            conn.execute(
                """
                SELECT set_config(
                    'request.jwt.claims',
                    %s,
                    true
                )
                """,
                (json.dumps(claims),)
            )

            # Keep the connection inside the active transaction.
            yield conn


def test_user_database_connection(user_id: str):
    """
    Verify that PostgreSQL recognises the authenticated
    role and the correct player's identity.
    """

    with user_database_connection(user_id) as conn:

        result = conn.execute(
            """
            SELECT
                current_user,
                auth.uid()
            """
        ).fetchone()

        return {
            "database_role": result[0],
            "authenticated_user_id": str(result[1])
        }
