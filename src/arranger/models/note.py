from pydantic import BaseModel, Field


class Note(BaseModel):
    """Atomic MIDI note — the universal unit across all layers."""

    note_number: int = Field(ge=0, le=127, description="MIDI pitch 0-127, C4=60")
    velocity: int = Field(ge=1, le=127, description="Strike force 1-127")
    start_tick: int = Field(ge=0, description="Absolute tick position")
    duration_tick: int = Field(gt=0, description="Length in ticks")
    channel: int = Field(ge=0, le=15, default=0, description="MIDI channel 0-15")
