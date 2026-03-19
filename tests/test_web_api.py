from io import BytesIO

import mido
from fastapi.testclient import TestClient

from arranger.web.app import app


def _build_input_midi_bytes() -> bytes:
    midi = mido.MidiFile(ticks_per_beat=480)
    track = mido.MidiTrack()
    midi.tracks.append(track)

    track.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(120), time=0))
    track.append(mido.MetaMessage("time_signature", numerator=3, denominator=4, time=0))
    track.append(mido.Message("note_on", note=60, velocity=90, channel=0, time=0))
    track.append(mido.Message("note_off", note=60, velocity=0, channel=0, time=480))
    track.append(mido.Message("note_on", note=64, velocity=90, channel=0, time=0))
    track.append(mido.Message("note_off", note=64, velocity=0, channel=0, time=480))
    track.append(mido.MetaMessage("end_of_track", time=0))

    buffer = BytesIO()
    midi.save(file=buffer)
    return buffer.getvalue()


def test_upload_midi_api_returns_melody_notes_and_metadata():
    client = TestClient(app)

    response = client.post(
        "/api/upload/midi",
        files={"file": ("melody.mid", _build_input_midi_bytes(), "audio/midi")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["tempo_bpm"] == 120
    assert payload["time_signature"] == "3/4"
    assert payload["summary"]["key"] == "C_major"
    assert len(payload["notes"]) == 2


def test_arrange_api_returns_midi_file():
    client = TestClient(app)

    response = client.post(
        "/api/arrange",
        data={"style": "pop", "mood": "neutral"},
        files={"file": ("melody.mid", _build_input_midi_bytes(), "audio/midi")},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/midi"
    assert "attachment;" in response.headers["content-disposition"]

    output_midi = mido.MidiFile(file=BytesIO(response.content))
    track_names = {
        message.name
        for track in output_midi.tracks
        for message in track
        if message.type == "track_name"
    }
    assert {"Lead Melody", "Drums", "Bass", "Piano"}.issubset(track_names)
