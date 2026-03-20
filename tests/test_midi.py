from pathlib import Path

import mido

from arranger.midi.builder import build_midi
from arranger.midi.parser import parse_midi
from arranger.models.arrangement import Arrangement, Track
from arranger.models.note import Note


def _sample_arrangement() -> Arrangement:
    notes = [
        Note(note_number=60, velocity=90, start_tick=0, duration_tick=480, channel=0),
        Note(note_number=64, velocity=88, start_tick=480, duration_tick=480, channel=0),
        Note(note_number=67, velocity=86, start_tick=960, duration_tick=480, channel=0),
        Note(
            note_number=72, velocity=92, start_tick=1440, duration_tick=480, channel=0
        ),
    ]
    track = Track(name="piano", channel=0, program=0, notes=notes)
    return Arrangement(
        tracks=[track],
        tempo=120,
        time_sig=(4, 4),
        ppq=480,
        total_bars=1,
    )


def test_build_midi_creates_valid_mid_file(tmp_path):
    arrangement = _sample_arrangement()
    output_path = tmp_path / "arranged.mid"

    returned_path = build_midi(arrangement, str(output_path))

    assert Path(returned_path).exists()
    midi_file = mido.MidiFile(str(output_path))
    assert midi_file.type == 1
    assert midi_file.ticks_per_beat == 480
    assert len(midi_file.tracks) >= 2


def test_parse_midi_reads_built_file(tmp_path):
    arrangement = _sample_arrangement()
    output_path = tmp_path / "arranged.mid"
    build_midi(arrangement, str(output_path))

    notes, metadata = parse_midi(str(output_path))

    assert len(notes) == len(arrangement.tracks[0].notes)
    assert metadata["ppq"] == 480
    assert metadata["time_sig"] == (4, 4)
    assert metadata["tempo"] == mido.bpm2tempo(120)


def test_midi_round_trip_note_count_matches(tmp_path):
    arrangement = _sample_arrangement()
    output_path = tmp_path / "round_trip.mid"
    build_midi(arrangement, str(output_path))

    parsed_notes, _ = parse_midi(str(output_path))
    expected_note_count = sum(len(track.notes) for track in arrangement.tracks)
    assert len(parsed_notes) == expected_note_count
