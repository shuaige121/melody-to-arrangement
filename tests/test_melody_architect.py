import pytest

import melody_architect.harmony as harmony
from melody_architect.models import NoteEvent
from melody_architect.theory import resolve_roman_to_chord


@pytest.mark.parametrize(
    ("token", "expected_quality", "expected_symbol", "expected_tones"),
    [
        ("IIIaug", "aug", "Eaug", (4, 8, 0)),
        ("Vsus2", "sus2", "Gsus2", (7, 9, 2)),
        ("ivsus4", "sus4", "Fsus4", (5, 10, 0)),
    ],
)
def test_resolve_roman_to_chord_supports_augmented_and_suspended_qualities(
    token: str,
    expected_quality: str,
    expected_symbol: str,
    expected_tones: tuple[int, ...],
) -> None:
    chord = resolve_roman_to_chord(token, tonic_pc=0, mode="major")

    assert chord.quality == expected_quality
    assert chord.symbol == expected_symbol
    assert chord.tones == expected_tones


def test_score_progression_uses_beat_unit_for_strong_beats() -> None:
    chord = resolve_roman_to_chord("I", tonic_pc=0, mode="major")
    note = NoteEvent(pitch=67, start=0.75, end=1.0)

    quarter_score = harmony._score_progression(
        (chord,),
        [[note]],
        beats_per_bar=6,
        tempo_bpm=120,
    )
    eighth_score = harmony._score_progression(
        (chord,),
        [[note]],
        beats_per_bar=6,
        tempo_bpm=120,
        beat_unit=8,
    )

    assert quarter_score == (9.0, 1.0, 0.0)
    assert eighth_score == (16.0, 1.0, 1.0)


def test_generate_harmony_candidates_uses_beat_unit_for_bar_grouping(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    note = NoteEvent(pitch=67, start=2.0, end=2.25)
    captured: list[tuple[list[list[NoteEvent]], int]] = []

    def fake_score_progression(
        chords,
        notes_grouped,
        beats_per_bar,
        tempo_bpm,
        beat_unit=4,
    ):
        captured.append((notes_grouped, beat_unit))
        return 0.0, 0.0, 0.0

    monkeypatch.setattr(harmony, "_score_progression", fake_score_progression)

    harmony.generate_harmony_candidates(
        notes=[note],
        tonic_pc=0,
        detected_mode="major",
        style="folk",
        bar_count=2,
        beats_per_bar=6,
        tempo_bpm=120,
        beat_unit=8,
    )

    assert captured
    assert all(beat_unit == 8 for _, beat_unit in captured)
    assert all(len(notes_grouped) == 2 for notes_grouped, _ in captured)
    assert all(not notes_grouped[0] for notes_grouped, _ in captured)
    assert all(notes_grouped[1] == [note] for notes_grouped, _ in captured)
