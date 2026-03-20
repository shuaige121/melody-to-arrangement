from __future__ import annotations

from dataclasses import dataclass


def _validate_pitch_class(value: int) -> int:
    return int(value) % 12


@dataclass(frozen=True, slots=True)
class NoteEvent:
    pitch: int
    start: float
    end: float
    velocity: int = 100

    def __post_init__(self) -> None:
        if not 0 <= self.pitch <= 127:
            raise ValueError(f"pitch out of MIDI range: {self.pitch}")
        if self.end < self.start:
            raise ValueError(f"end must be >= start: {self.start} -> {self.end}")
        if not 0 <= self.velocity <= 127:
            raise ValueError(f"velocity out of MIDI range: {self.velocity}")

    @property
    def duration(self) -> float:
        return self.end - self.start

    @property
    def pitch_class(self) -> int:
        return self.pitch % 12


@dataclass(frozen=True, slots=True)
class Chord:
    root_pc: int
    root_name: str
    quality: str
    symbol: str
    roman: str
    tones: tuple[int, ...]

    def __post_init__(self) -> None:
        if not self.root_name:
            raise ValueError("root_name must not be empty")
        if not self.quality:
            raise ValueError("quality must not be empty")
        if not self.symbol:
            raise ValueError("symbol must not be empty")
        if not self.tones:
            raise ValueError("tones must not be empty")

        object.__setattr__(self, "root_pc", _validate_pitch_class(self.root_pc))
        object.__setattr__(
            self, "tones", tuple(_validate_pitch_class(tone) for tone in self.tones)
        )


@dataclass(frozen=True, slots=True)
class HarmonyCandidate:
    name: str
    mode: str
    bars: tuple[Chord, ...]
    score: float
    chord_tone_coverage: float
    strong_beat_coverage: float

    def __post_init__(self) -> None:
        if not self.name:
            raise ValueError("name must not be empty")
        if not self.mode:
            raise ValueError("mode must not be empty")

        object.__setattr__(self, "bars", tuple(self.bars))

    @property
    def chords(self) -> tuple[Chord, ...]:
        return self.bars


__all__ = ["Chord", "HarmonyCandidate", "NoteEvent"]
