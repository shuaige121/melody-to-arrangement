from pathlib import Path

import mido
import pytest
from arranger.models.arrangement import AnalysisResult, ArrangementStrategy
from arranger.models.note import Note
from arranger.patterns.bass import generate_bass_line
from arranger.patterns.drums import DRUM_PATTERNS, drum_pattern_to_notes
from arranger.patterns.piano import generate_piano_comp

try:
    from arranger.engine import arrange_melody
    from arranger.engine.arrange import _validate_track_notes
except Exception:
    arrange_melody = None
    _validate_track_notes = None


pytestmark = pytest.mark.skipif(
    arrange_melody is None or _validate_track_notes is None,
    reason="arranger.engine arrange helpers are not available in this build",
)


def _write_input_midi(path: Path) -> None:
    midi = mido.MidiFile(ticks_per_beat=480)
    track = mido.MidiTrack()
    midi.tracks.append(track)

    track.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(120), time=0))
    track.append(mido.MetaMessage("time_signature", numerator=4, denominator=4, time=0))
    track.append(mido.Message("note_on", note=60, velocity=90, channel=0, time=0))
    track.append(mido.Message("note_off", note=60, velocity=0, channel=0, time=480))
    track.append(mido.Message("note_on", note=64, velocity=90, channel=0, time=0))
    track.append(mido.Message("note_off", note=64, velocity=0, channel=0, time=480))
    track.append(mido.Message("note_on", note=67, velocity=90, channel=0, time=0))
    track.append(mido.Message("note_off", note=67, velocity=0, channel=0, time=480))
    track.append(mido.MetaMessage("end_of_track", time=0))
    midi.save(path)


def _write_metered_input_midi(
    path: Path,
    *,
    numerator: int,
    denominator: int,
    note_duration_ticks: int,
    note_count: int,
) -> None:
    midi = mido.MidiFile(ticks_per_beat=480)
    track = mido.MidiTrack()
    midi.tracks.append(track)

    track.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(120), time=0))
    track.append(mido.MetaMessage("time_signature", numerator=numerator, denominator=denominator, time=0))

    for idx in range(note_count):
        pitch = 60 + (idx % 5)
        track.append(mido.Message("note_on", note=pitch, velocity=90, channel=0, time=0))
        track.append(mido.Message("note_off", note=pitch, velocity=0, channel=0, time=note_duration_ticks))

    track.append(mido.MetaMessage("end_of_track", time=0))
    midi.save(path)


def _write_multitrack_input_midi(path: Path) -> None:
    midi = mido.MidiFile(ticks_per_beat=480)

    meta_track = mido.MidiTrack()
    meta_track.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(120), time=0))
    meta_track.append(mido.MetaMessage("time_signature", numerator=4, denominator=4, time=0))
    meta_track.append(mido.MetaMessage("end_of_track", time=0))
    midi.tracks.append(meta_track)

    low_track = mido.MidiTrack()
    low_track.append(mido.MetaMessage("track_name", name="bass_input", time=0))
    low_track.append(mido.Message("note_on", note=36, velocity=80, channel=1, time=0))
    low_track.append(mido.Message("note_off", note=36, velocity=0, channel=1, time=480))
    low_track.append(mido.Message("note_on", note=38, velocity=80, channel=1, time=0))
    low_track.append(mido.Message("note_off", note=38, velocity=0, channel=1, time=480))
    low_track.append(mido.MetaMessage("end_of_track", time=0))
    midi.tracks.append(low_track)

    melody_track = mido.MidiTrack()
    melody_track.append(mido.MetaMessage("track_name", name="melody_input", time=0))
    melody_track.append(mido.Message("note_on", note=72, velocity=90, channel=0, time=0))
    melody_track.append(mido.Message("note_off", note=72, velocity=0, channel=0, time=480))
    melody_track.append(mido.Message("note_on", note=76, velocity=90, channel=0, time=0))
    melody_track.append(mido.Message("note_off", note=76, velocity=0, channel=0, time=480))
    melody_track.append(mido.MetaMessage("end_of_track", time=0))
    midi.tracks.append(melody_track)

    midi.save(path)


def _track_name(track: mido.MidiTrack) -> str | None:
    for message in track:
        if message.type == "track_name":
            return message.name
    return None


def _absolute_note_on_ticks(track: mido.MidiTrack) -> list[int]:
    ticks = 0
    starts: list[int] = []
    for message in track:
        ticks += message.time
        if message.type == "note_on" and message.velocity > 0:
            starts.append(ticks)
    return starts


def test_arrange_pipeline_creates_output_without_api_key(tmp_path, monkeypatch):
    input_path = tmp_path / "input.mid"
    output_path = tmp_path / "output.mid"
    _write_input_midi(input_path)

    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    arrange_melody(
        input_path=str(input_path),
        output_path=str(output_path),
        style="pop",
        mood="neutral",
    )

    assert output_path.exists()
    output_midi = mido.MidiFile(str(output_path))
    assert "Lead Melody" in {_track_name(track) for track in output_midi.tracks}


def test_validate_track_notes_applies_guardrails():
    analysis = AnalysisResult(
        key="C_major",
        tempo=120,
        time_sig=(4, 4),
        total_bars=1,
        sections=[],
        melody_range=(60, 72),
        melody_density="medium",
    )
    strategy = ArrangementStrategy(
        progression_style="I-V-vi-IV",
        drum_style="4_4_basic",
        bass_style="root_octave",
        piano_style="block_chord",
        energy_curve=["medium"],
    )
    bad_notes = [
        Note(note_number=58, velocity=90, start_tick=125, duration_tick=61, channel=1),
    ]

    fixed_notes = _validate_track_notes(bad_notes, analysis=analysis, strategy=strategy, track_name="bass")

    assert len(fixed_notes) == 1
    assert fixed_notes[0].note_number % 12 in {0, 2, 4, 5, 7, 9, 11}
    assert 28 <= fixed_notes[0].note_number <= 55
    assert fixed_notes[0].start_tick % 120 == 0
    assert fixed_notes[0].duration_tick % 120 == 0


def test_arrange_pipeline_uses_extracted_melody_track_for_multitrack_input(tmp_path, monkeypatch):
    input_path = tmp_path / "multitrack.mid"
    output_path = tmp_path / "output.mid"
    _write_multitrack_input_midi(input_path)

    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    arrange_melody(
        input_path=str(input_path),
        output_path=str(output_path),
        style="pop",
        mood="neutral",
    )

    output_midi = mido.MidiFile(str(output_path))
    lead_track = next(track for track in output_midi.tracks if _track_name(track) == "Lead Melody")
    lead_pitches = {
        message.note
        for message in lead_track
        if message.type == "note_on" and message.velocity > 0
    }

    assert lead_pitches == {72, 76}


def test_generate_piano_comp_respects_three_four_meter():
    notes = generate_piano_comp(
        chords=[[60, 64, 67]],
        style="block_chord",
        bars=1,
        ppq=480,
        time_sig=(3, 4),
    )

    starts = sorted({note.start_tick for note in notes})
    assert starts == [0, 480, 960]


def test_drum_pattern_respects_six_eight_bar_length():
    notes = drum_pattern_to_notes(
        DRUM_PATTERNS["4_4_basic"],
        bar_start_tick=0,
        ppq=480,
        time_sig=(6, 8),
    )

    assert notes
    assert all(note.start_tick % 240 == 0 for note in notes)
    assert max(note.start_tick + note.duration_tick for note in notes) <= 1440


def test_arrange_pipeline_preserves_six_eight_grid_for_accompaniment(tmp_path, monkeypatch):
    input_path = tmp_path / "compound.mid"
    output_path = tmp_path / "output.mid"
    _write_metered_input_midi(
        input_path,
        numerator=6,
        denominator=8,
        note_duration_ticks=240,
        note_count=12,
    )

    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    arrange_melody(
        input_path=str(input_path),
        output_path=str(output_path),
        style="pop",
        mood="neutral",
    )

    output_midi = mido.MidiFile(str(output_path))
    tempo_track = output_midi.tracks[0]
    time_signature = next(message for message in tempo_track if message.type == "time_signature")
    assert (time_signature.numerator, time_signature.denominator) == (6, 8)

    bass_track = next(track for track in output_midi.tracks if _track_name(track) == "Bass")
    piano_track = next(track for track in output_midi.tracks if _track_name(track) == "Piano")

    bass_starts = _absolute_note_on_ticks(bass_track)
    piano_starts = _absolute_note_on_ticks(piano_track)

    assert bass_starts == [0, 1440]
    assert piano_starts
    assert all(start % 240 == 0 for start in piano_starts)
    assert max(piano_starts) < 2880


def test_generate_bass_line_uses_compound_meter_beats():
    notes = generate_bass_line(
        chords=[[60, 64, 67]],
        style="arpeggio",
        bars=1,
        ppq=480,
        time_sig=(6, 8),
    )

    starts = [note.start_tick for note in notes]
    assert starts == [0, 240, 480, 720, 960, 1200]
