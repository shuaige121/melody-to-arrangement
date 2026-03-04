import pytest
from pydantic import ValidationError

from arranger.models.arrangement import AnalysisResult, ArrangementStrategy
from arranger.models.guardrail import GuardrailSet
from arranger.models.note import Note


def test_note_validation_accepts_valid_values():
    note = Note(note_number=60, velocity=80, start_tick=0, duration_tick=480, channel=0)
    assert note.note_number == 60
    assert note.velocity == 80


@pytest.mark.parametrize(
    "payload",
    [
        {"note_number": 128, "velocity": 80, "start_tick": 0, "duration_tick": 120, "channel": 0},
        {"note_number": 60, "velocity": 0, "start_tick": 0, "duration_tick": 120, "channel": 0},
        {"note_number": 60, "velocity": 80, "start_tick": -1, "duration_tick": 120, "channel": 0},
        {"note_number": 60, "velocity": 80, "start_tick": 0, "duration_tick": 0, "channel": 0},
        {"note_number": 60, "velocity": 80, "start_tick": 0, "duration_tick": 120, "channel": 16},
    ],
)
def test_note_validation_rejects_invalid_values(payload):
    with pytest.raises(ValidationError):
        Note(**payload)


def test_note_model_copy_keeps_original_intact():
    original = Note(note_number=60, velocity=80, start_tick=0, duration_tick=480, channel=0)
    copied = original.model_copy(update={"note_number": 62})

    assert original.note_number == 60
    assert copied.note_number == 62
    assert copied is not original


def test_analysis_result_construction():
    result = AnalysisResult(
        key="C_major",
        tempo=120,
        total_bars=4,
        sections=[{"name": "verse", "start_bar": 0, "end_bar": 4}],
        melody_range=(60, 72),
        melody_density="medium",
    )
    assert result.key == "C_major"
    assert result.time_sig == (4, 4)
    assert result.total_bars == 4


def test_arrangement_strategy_construction():
    strategy = ArrangementStrategy(
        progression_style="I-V-vi-IV",
        drum_style="4_4_basic",
        bass_style="root_octave",
        piano_style="block_chord",
        energy_curve=["low", "medium", "high", "medium"],
    )
    assert strategy.progression_style == "I-V-vi-IV"
    assert len(strategy.energy_curve) == 4


def test_guardrail_set_defaults():
    guardrails = GuardrailSet(
        key_name="C_major",
        allowed_pitch_classes={0, 2, 4, 5, 7, 9, 11},
    )
    assert guardrails.tick_grid == 120
    assert guardrails.note_ranges["bass"] == (28, 55)
    assert guardrails.note_ranges["piano"] == (48, 84)
    assert guardrails.velocity_range == (40, 120)
