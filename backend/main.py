
from uuid import UUID

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import (
    HTTPBearer,
    HTTPAuthorizationCredentials,
)

import httpx
import psycopg

from backend.config import (
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    validate_config,
)

from backend.database import test_user_database_connection

from backend.schemas import (
    MatchSubmission,
    PlayerScoutAssessmentCreate,
    PlayerScoutAssessmentUpdate,
)

from backend.match_service import (
    submit_player_match,
    get_player_matches,
)

from backend.assessment_service import (
    create_player_assessment,
    get_player_assessments,
    get_player_assessment,
    update_player_assessment,
    delete_player_assessment,
)


# =====================================================
# 1. APPLICATION CONFIGURATION
# =====================================================

app = FastAPI(
    title="Pata Talanta API",
    description="Backend API for the Pata Talanta sports intelligence platform.",
    version="1.1.0",
)

validate_config()


# =====================================================
# 2. CORS CONFIGURATION
# =====================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Authorization",
        "Content-Type",
    ],
)


# =====================================================
# 3. AUTHENTICATION CONFIGURATION
# =====================================================

bearer_scheme = HTTPBearer(auto_error=False)


async def verify_supabase_token(
    credentials: HTTPAuthorizationCredentials | None,
):
    """
    Verify the Supabase access token.

    The access token is never printed or logged.
    """

    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication credentials are required.",
        )

    if credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication scheme.",
        )

    access_token = credentials.credentials

    try:
        response = httpx.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "apikey": SUPABASE_PUBLISHABLE_KEY,
                "Authorization": f"Bearer {access_token}",
            },
            timeout=10.0,
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired authentication token.",
            )

        return response.json()

    except httpx.RequestError:
        raise HTTPException(
            status_code=503,
            detail="Unable to contact Supabase authentication service.",
        )


# =====================================================
# 4. ROOT ENDPOINT
# =====================================================

@app.get("/")
def root():
    return {
        "message": "Pata Talanta API is running.",
        "status": "online",
    }


# =====================================================
# 5. AUTHENTICATION ENDPOINT
# =====================================================

@app.get("/auth/me")
async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
):
    user = await verify_supabase_token(credentials)

    return {
        "authenticated": True,
        "user_id": user.get("id"),
        "email": user.get("email"),
    }


# =====================================================
# 6. DATABASE CONNECTION TEST
# =====================================================

@app.get("/database-test")
async def database_test(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
):
    user = await verify_supabase_token(credentials)

    user_id = user["id"]

    try:
        result = test_user_database_connection(user_id)

        return {
            "message": "Database authentication successful.",
            "database_role": result["database_role"],
            "authenticated_user_id": result["authenticated_user_id"],
        }

    except psycopg.Error:
        raise HTTPException(
            status_code=500,
            detail="Database connection or permission test failed.",
        )


# =====================================================
# 7. SUBMIT A PLAYER MATCH
# =====================================================

@app.post("/matches")
async def create_match(
    match_data: MatchSubmission,
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
):
    user = await verify_supabase_token(credentials)

    user_id = user["id"]

    try:
        result = submit_player_match(
            user_id=user_id,
            match_data=match_data,
        )

        return {
            "message": "Match submitted successfully.",
            "player_id": user_id,
            "match": result,
        }

    except psycopg.Error:
        raise HTTPException(
            status_code=500,
            detail="Database error occurred while submitting the match.",
        )

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while submitting the match.",
        )


# =====================================================
# 8. RETRIEVE PLAYER MATCHES
# =====================================================

@app.get("/matches")
async def retrieve_matches(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
):
    user = await verify_supabase_token(credentials)

    user_id = user["id"]

    try:
        matches = get_player_matches(user_id)

        return {
            "message": "Matches retrieved successfully.",
            "player_id": user_id,
            "total_matches": len(matches),
            "matches": matches,
        }

    except psycopg.Error:
        raise HTTPException(
            status_code=500,
            detail="Database error occurred while retrieving matches.",
        )

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while retrieving matches.",
        )


# =====================================================
# 9. SUBMIT PLAYER SCOUT ASSESSMENT
# =====================================================

@app.post("/assessments", status_code=201)
async def create_assessment(
    assessment_data: PlayerScoutAssessmentCreate,
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
):
    user = await verify_supabase_token(credentials)

    user_id = user["id"]

    try:
        assessment = create_player_assessment(
            user_id=user_id,
            assessment_data=assessment_data,
        )

        return {
            "message": "Player assessment submitted successfully.",
            "assessment": assessment,
        }

    except psycopg.errors.UniqueViolation:
        raise HTTPException(
            status_code=409,
            detail="An assessment already exists for this scout, player and match.",
        )

    except psycopg.errors.InsufficientPrivilege:
        raise HTTPException(
            status_code=403,
            detail="Only approved scouts can submit assessments for players.",
        )

    except psycopg.errors.ForeignKeyViolation:
        raise HTTPException(
            status_code=422,
            detail="The specified player or match does not exist.",
        )

    except psycopg.errors.CheckViolation:
        raise HTTPException(
            status_code=422,
            detail="The assessment violates a database validation rule.",
        )

    except psycopg.Error:
        raise HTTPException(
            status_code=500,
            detail="Database error occurred while submitting the assessment.",
        )


# =====================================================
# 10. RETRIEVE ASSESSMENTS
# =====================================================

@app.get("/assessments")
async def retrieve_assessments(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
):
    user = await verify_supabase_token(credentials)

    user_id = user["id"]

    try:
        assessments = get_player_assessments(user_id)

        return {
            "message": "Assessments retrieved successfully.",
            "user_id": user_id,
            "total_assessments": len(assessments),
            "assessments": assessments,
        }

    except psycopg.Error:
        raise HTTPException(
            status_code=500,
            detail="Database error occurred while retrieving assessments.",
        )


# =====================================================
# 11. RETRIEVE ONE ASSESSMENT
# =====================================================

@app.get("/assessments/{assessment_id}")
async def retrieve_assessment(
    assessment_id: UUID,
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
):
    user = await verify_supabase_token(credentials)

    user_id = user["id"]

    try:
        assessment = get_player_assessment(
            user_id=user_id,
            assessment_id=str(assessment_id),
        )

        if assessment is None:
            raise HTTPException(
                status_code=404,
                detail="Assessment not found or access denied.",
            )

        return {
            "message": "Assessment retrieved successfully.",
            "assessment": assessment,
        }

    except psycopg.Error:
        raise HTTPException(
            status_code=500,
            detail="Database error occurred while retrieving the assessment.",
        )


# =====================================================
# 12. UPDATE PLAYER SCOUT ASSESSMENT
# =====================================================

@app.patch("/assessments/{assessment_id}")
async def edit_assessment(
    assessment_id: UUID,
    update_data: PlayerScoutAssessmentUpdate,
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
):
    user = await verify_supabase_token(credentials)

    user_id = user["id"]

    try:
        updated_assessment = update_player_assessment(
            user_id=user_id,
            assessment_id=str(assessment_id),
            update_data=update_data.model_dump(
                exclude_unset=True
            ),
        )

        if updated_assessment is None:
            raise HTTPException(
                status_code=404,
                detail="Assessment not found or access denied.",
            )

        return {
            "message": "Assessment updated successfully.",
            "assessment": updated_assessment,
        }

    except psycopg.errors.InsufficientPrivilege:
        raise HTTPException(
            status_code=403,
            detail="You are not authorised to update this assessment.",
        )

    except psycopg.errors.CheckViolation:
        raise HTTPException(
            status_code=422,
            detail="The updated assessment violates a database validation rule.",
        )

    except psycopg.Error:
        raise HTTPException(
            status_code=500,
            detail="Database error occurred while updating the assessment.",
        )


# =====================================================
# 13. DELETE PLAYER SCOUT ASSESSMENT
# =====================================================

@app.delete("/assessments/{assessment_id}")
async def remove_assessment(
    assessment_id: UUID,
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
):
    user = await verify_supabase_token(credentials)

    user_id = user["id"]

    try:
        deleted_id = delete_player_assessment(
            user_id=user_id,
            assessment_id=str(assessment_id),
        )

        if deleted_id is None:
            raise HTTPException(
                status_code=404,
                detail="Assessment not found or access denied.",
            )

        return {
            "message": "Assessment deleted successfully.",
            "assessment_id": deleted_id,
        }

    except psycopg.errors.InsufficientPrivilege:
        raise HTTPException(
            status_code=403,
            detail="You are not authorised to delete this assessment.",
        )

    except psycopg.Error:
        raise HTTPException(
            status_code=500,
            detail="Database error occurred while deleting the assessment.",
        )
