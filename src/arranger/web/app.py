from __future__ import annotations

import shutil
from pathlib import Path
from tempfile import NamedTemporaryFile

import mido
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

from arranger.analysis.melody import analyze_melody
from arranger.engine.arrange import arrange_melody
from arranger.midi.parser import extract_melody_track, parse_midi

app = FastAPI(title="Logic Pro Audio Arranger")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

REPO_ROOT = Path(__file__).resolve().parents[3]
BUNDLED_STATIC_DIR = Path(__file__).resolve().parent / "static"
FRONTEND_DIST_DIR = REPO_ROOT / "web" / "dist"
FRONTEND_DIR = FRONTEND_DIST_DIR if FRONTEND_DIST_DIR.is_dir() else BUNDLED_STATIC_DIR
MIDI_SUFFIXES = {".mid", ".midi"}


def _safe_suffix(filename: str | None) -> str:
    suffix = Path(filename or "").suffix.lower()
    return suffix if suffix else ".bin"


def _persist_upload(file: UploadFile) -> Path:
    suffix = _safe_suffix(file.filename)
    with NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        shutil.copyfileobj(file.file, temp_file)
        return Path(temp_file.name)


def _tempo_bpm_from_metadata(metadata: dict) -> int:
    raw_tempo = metadata.get("tempo")
    try:
        if raw_tempo:
            return int(round(mido.tempo2bpm(int(raw_tempo))))
    except (TypeError, ValueError, ZeroDivisionError):
        pass
    return 120


def _time_signature_string(raw: tuple[int, int] | list[int] | None) -> str:
    if isinstance(raw, (tuple, list)) and len(raw) == 2:
        return f"{int(raw[0])}/{int(raw[1])}"
    return "4/4"


def _note_to_event(note, ppq: int, tempo_microseconds: int) -> dict[str, float | int]:
    start = float(mido.tick2second(int(note.start_tick), ppq, tempo_microseconds))
    duration = float(mido.tick2second(int(note.duration_tick), ppq, tempo_microseconds))
    return {
        "pitch": int(note.note_number),
        "start": round(start, 6),
        "duration": round(duration, 6),
        "velocity": int(note.velocity),
    }


def _build_midi_payload(path: Path) -> dict:
    _, metadata = parse_midi(str(path))
    melody_notes = extract_melody_track(str(path))
    if not melody_notes:
        raise HTTPException(status_code=400, detail="No melody notes found in uploaded MIDI")

    tempo_microseconds = int(metadata.get("tempo", 500000))
    ppq = max(1, int(metadata.get("ppq", 480)))
    time_sig = metadata.get("time_sig", (4, 4))
    tempo_bpm = _tempo_bpm_from_metadata(metadata)

    analysis = analyze_melody(
        melody_notes,
        tempo_bpm=tempo_bpm,
        time_sig=time_sig,
        ppq=ppq,
    )

    return {
        "ok": True,
        "status": "ok",
        "filename": path.name,
        "notes": [_note_to_event(note, ppq, tempo_microseconds) for note in melody_notes],
        "tempo_bpm": tempo_bpm,
        "time_signature": _time_signature_string(time_sig),
        "summary": {
            "key": analysis.key,
            "bars": analysis.total_bars,
            "density": analysis.melody_density,
            "range": list(analysis.melody_range),
        },
        "message": f"Parsed {len(melody_notes)} melody notes",
    }


@app.post("/api/upload/audio")
async def upload_audio(file: UploadFile = File(...), source_type: str = Form("vocal")):
    raise HTTPException(
        status_code=501,
        detail=f"Audio transcription is not available in this build for source type '{source_type}'. Upload MIDI instead.",
    )


@app.post("/api/upload/midi")
async def upload_midi(file: UploadFile = File(...)):
    upload_path = _persist_upload(file)
    try:
        if upload_path.suffix.lower() not in MIDI_SUFFIXES:
            raise HTTPException(status_code=400, detail="Only .mid and .midi files are supported")
        payload = _build_midi_payload(upload_path)
        payload["filename"] = file.filename or upload_path.name
        return payload
    finally:
        upload_path.unlink(missing_ok=True)


@app.post("/api/digitize")
async def digitize(
    file: UploadFile = File(...),
    source_type: str = Form("vocal"),
    style: str = Form("pop"),
):
    del source_type, style
    suffix = _safe_suffix(file.filename)
    if suffix in MIDI_SUFFIXES:
        return await upload_midi(file=file)
    raise HTTPException(
        status_code=501,
        detail="Backend digitization for audio files is not available in this build. Upload MIDI instead.",
    )


@app.post("/api/arrange")
async def arrange(
    file: UploadFile = File(...),
    style: str = Form("pop"),
    mood: str = Form("neutral"),
):
    input_path = _persist_upload(file)
    with NamedTemporaryFile(delete=False, suffix="_arranged.mid") as output_file:
        output_path = Path(output_file.name)

    try:
        if input_path.suffix.lower() not in MIDI_SUFFIXES:
            raise HTTPException(status_code=400, detail="Arrangement input must be a MIDI file")

        arrange_melody(
            input_path=str(input_path),
            output_path=str(output_path),
            style=style,
            mood=mood,
        )
        output_bytes = output_path.read_bytes()
        stem = Path(file.filename or "arrangement").stem
        return Response(
            content=output_bytes,
            media_type="audio/midi",
            headers={
                "Content-Disposition": f'attachment; filename="{stem}_arranged.mid"',
            },
        )
    finally:
        input_path.unlink(missing_ok=True)
        output_path.unlink(missing_ok=True)


app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
