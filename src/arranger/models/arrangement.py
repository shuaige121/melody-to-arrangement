from pydantic import BaseModel, Field

from .note import Note


class Track(BaseModel):
    """Single MIDI track."""

    name: str
    channel: int = Field(ge=0, le=15)
    program: int = Field(ge=0, le=127, default=0)
    notes: list[Note] = []


class AnalysisResult(BaseModel):
    """Output of structure analysis layer."""

    key: str  # e.g. "C_major", "A_minor"
    tempo: int = Field(gt=20, lt=300)
    time_sig: tuple[int, int] = (4, 4)
    total_bars: int
    sections: list[dict]  # [{"name": "verse", "start_bar": 0, "end_bar": 8}, ...]
    melody_range: tuple[int, int]  # (lowest_note, highest_note)
    melody_density: str  # "sparse" | "medium" | "dense"


class ArrangementStrategy(BaseModel):
    """Output of LLM decision layer — strategy only, no notes."""

    progression_style: str  # e.g. "I-V-vi-IV"
    drum_style: str  # e.g. "4_4_basic"
    bass_style: str  # e.g. "root_octave"
    piano_style: str  # e.g. "block_chord"
    energy_curve: list[str]  # per-section energy: ["low", "medium", "high", "medium"]


class Arrangement(BaseModel):
    """Final multi-track arrangement."""

    tracks: list[Track]
    tempo: int
    time_sig: tuple[int, int]
    ppq: int = 480
    total_bars: int
    metadata: dict = {}
