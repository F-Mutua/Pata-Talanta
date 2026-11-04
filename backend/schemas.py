
from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    Field,
    model_validator,
)


# =====================================================
# 1. PERFORMANCE STATISTICS
# =====================================================

class PerformanceStatsInput(BaseModel):
    """Player's manually submitted match statistics."""

    goals: int = Field(default=0, ge=0)
    assists: int = Field(default=0, ge=0)
    shots: int = Field(default=0, ge=0)
    shots_on_target: int = Field(default=0, ge=0)
    tackles: int = Field(default=0, ge=0)
    interceptions: int = Field(default=0, ge=0)

    passes_completed: int | None = Field(default=None, ge=0)
    passes_attempted: int | None = Field(default=None, ge=0)

    distance_km: float | None = Field(default=None, ge=0)
    top_speed_kmh: float | None = Field(default=None, ge=0)
    sprint_count: int | None = Field(default=None, ge=0)
    touches: int | None = Field(default=None, ge=0)

    notes: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def validate_statistics(self):
        if self.shots_on_target > self.shots:
            raise ValueError(
                "Shots on target cannot exceed total shots."
            )

        if (
            self.passes_completed is not None
            and self.passes_attempted is not None
            and self.passes_completed > self.passes_attempted
        ):
            raise ValueError(
                "Completed passes cannot exceed attempted passes."
            )

        return self


# =====================================================
# 2. MATCH SUBMISSION
# =====================================================

class MatchSubmission(BaseModel):
    """Match information submitted by an authenticated player."""

    opponent: str = Field(min_length=1, max_length=150)

    match_date: date

    club_name: str | None = Field(default=None, max_length=150)
    competition: str | None = Field(default=None, max_length=150)
    venue: str | None = Field(default=None, max_length=200)

    match_type: Literal["home", "away", "neutral"] | None = None

    team_goals: int | None = Field(default=None, ge=0)
    opponent_goals: int | None = Field(default=None, ge=0)

    notes: str | None = Field(default=None, max_length=2000)

    minutes_played: int | None = Field(default=None, ge=0, le=130)
    started: bool = False
    position_played: str | None = Field(default=None, max_length=100)

    performance_stats: PerformanceStatsInput = Field(
        default_factory=PerformanceStatsInput
    )


# =====================================================
# 3. CREATE PLAYER SCOUT ASSESSMENT
# =====================================================

class PlayerScoutAssessmentCreate(BaseModel):
    """Assessment submitted by an authenticated approved scout."""

    player_id: UUID

    match_id: UUID | None = None

    technical_rating: int = Field(ge=1, le=5)

    tactical_rating: int = Field(ge=1, le=5)

    decision_making_rating: int = Field(ge=1, le=5)

    strengths: str | None = Field(
        default=None,
        max_length=3000
    )

    development_areas: str | None = Field(
        default=None,
        max_length=3000
    )

    overall_assessment: str | None = Field(
        default=None,
        max_length=5000
    )

    recommendation: str | None = Field(
        default=None,
        max_length=2000
    )


# =====================================================
# 4. UPDATE PLAYER SCOUT ASSESSMENT
# =====================================================

class PlayerScoutAssessmentUpdate(BaseModel):
    """Fields an approved scout can update in their assessment."""

    technical_rating: int | None = Field(
        default=None,
        ge=1,
        le=5
    )

    tactical_rating: int | None = Field(
        default=None,
        ge=1,
        le=5
    )

    decision_making_rating: int | None = Field(
        default=None,
        ge=1,
        le=5
    )

    strengths: str | None = Field(
        default=None,
        max_length=3000
    )

    development_areas: str | None = Field(
        default=None,
        max_length=3000
    )

    overall_assessment: str | None = Field(
        default=None,
        max_length=5000
    )

    recommendation: str | None = Field(
        default=None,
        max_length=2000
    )

    @model_validator(mode="after")
    def validate_update(self):

        if not self.model_fields_set:
            raise ValueError(
                "At least one assessment field must be provided."
            )

        rating_fields = [
            "technical_rating",
            "tactical_rating",
            "decision_making_rating",
        ]

        for field in rating_fields:
            if (
                field in self.model_fields_set
                and getattr(self, field) is None
            ):
                raise ValueError(
                    f"{field} cannot be null."
                )

        return self
