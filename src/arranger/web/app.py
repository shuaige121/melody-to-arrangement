from fastapi import FastAPI, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

app = FastAPI(title="Logic Pro Audio Arranger")

static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/")
async def index():
    return FileResponse(os.path.join(static_dir, "index.html"))


@app.post("/api/upload/audio")
async def upload_audio(file: UploadFile = File(...), source_type: str = "vocal"):
    """Upload audio file (mp3/wav) for transcription to MIDI."""
    return {
        "status": "ok",
        "filename": file.filename,
        "source_type": source_type,
        "message": "TODO: transcribe",
    }


@app.post("/api/upload/midi")
async def upload_midi(file: UploadFile = File(...)):
    """Upload MIDI or project file."""
    return {
        "status": "ok",
        "filename": file.filename,
        "message": "TODO: parse and arrange",
    }


@app.post("/api/arrange")
async def arrange(style: str = "pop", mood: str = "neutral"):
    """Trigger arrangement with selected style and mood."""
    return {
        "status": "ok",
        "style": style,
        "mood": mood,
        "message": "TODO: run arrangement pipeline",
    }
