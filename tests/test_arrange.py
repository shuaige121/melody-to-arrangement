from pathlib import Path

import mido
import pytest

try:
    from arranger.engine import arrange_melody
except Exception:
    arrange_melody = None


pytestmark = pytest.mark.skipif(
    arrange_melody is None,
    reason="arranger.engine.arrange_melody is not available in this build",
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
