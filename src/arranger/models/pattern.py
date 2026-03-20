from pydantic import BaseModel, Field

from .note import Note


class Pattern(BaseModel):
    """Reusable musical pattern (chord progression, drum loop, bass line, etc.)."""

    pattern_type: (
        str  # "chord_progression" | "drum_pattern" | "bass_line" | "piano_comp"
    )
    notes: list[Note]
    bars: int = Field(gt=0, description="Length in bars")
    time_sig: tuple[int, int] = (4, 4)
    tags: dict[str, list[str]] = {}  # mood: [...], genre: [...], section: [...]


class DrumHit(BaseModel):
    """Single drum hit in a grid pattern."""

    step: int = Field(ge=0, lt=16, description="Step in 16-step grid (0-15)")
    note_number: int = Field(ge=35, le=81, description="GM drum note")
    velocity: int = Field(ge=1, le=127)


class DrumPattern(BaseModel):
    """Drum pattern as a grid — 16 steps per bar."""

    name: str
    hits: list[DrumHit]
    bars: int = 1
    tags: dict[str, list[str]] = {}
