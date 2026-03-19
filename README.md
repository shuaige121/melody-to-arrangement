<div align="center">

# Melody to Arrangement

**AI-powered melody-to-arrangement engine**

Turn a single melody MIDI into a full multi-track arrangement — drums, bass, piano, and chords — with music theory guardrails that keep everything musically correct.

[![Live Demo](https://img.shields.io/badge/demo-zhouruby.com%2Farranger-blue)](https://zhouruby.com/arranger/)
[![Python 3.12+](https://img.shields.io/badge/python-3.12+-3776AB?logo=python&logoColor=white)](https://python.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

</div>

---

Rule-constrained LLM + classical music theory = AI auto-arrangement that actually sounds right. Choose from 9 styles (Pop, Rock, Jazz, EDM, Latin, Funk, R&B, Ballad, Country) and 6 moods (Happy, Sad, Energetic, Chill, Epic, Neutral) to shape the output.

## How It Works

```
Input MIDI → Melody Analysis → LLM Strategy Router → Pattern Generation → Guardrail Validation → Output MIDI
```

### 4-Layer Pipeline

| Layer | Module | Role |
|-------|--------|------|
| **Analysis** | `arranger.analysis` | Key detection, tempo estimation, phrase segmentation, structure recognition |
| **Strategy** | `arranger.engine.llm` | LLM selects style-appropriate progressions, drum patterns, bass and piano styles |
| **Patterns** | `arranger.patterns` | Rule-based generators for drums, bass, chords, piano accompaniment |
| **Guardrails** | `arranger.guardrails` | Post-generation validation: harmony, key, rhythm, and range constraints |

The LLM (Claude API) picks the arrangement strategy; rule-based generators produce the MIDI. If the LLM is unavailable, the engine falls back to deterministic rules. Guardrails run last to catch any theory violations.

## Quick Start

```bash
git clone https://github.com/shuaige121/melody-to-arrangement.git
cd melody-to-arrangement
uv sync
```

### Arrange a melody

```bash
arranger arrange -i melody.mid -s pop -m happy -o output.mid
```

### Analyze a MIDI file

```bash
arranger analyze -i melody.mid
```

### Start the API server

```bash
arranger serve
```

`arranger serve` exposes the FastAPI endpoints immediately. For the full React DAW UI, build the frontend first:

```bash
cd web && npm install && npm run build
```

### List available styles

```bash
arranger styles
```

## Web UI

A browser-based DAW interface built with React 19, TypeScript, Vite, and Tone.js. Try it live at [zhouruby.com/arranger](https://zhouruby.com/arranger/).

```bash
cd web && npm install && npm run dev
```

Current input support in the web app:
- MIDI and MusicXML are first-class inputs.
- Audio import uses a lightweight browser-side monophonic estimator and works best on clean single-note melodies.

## Project Structure

```
src/arranger/
├── analysis/       # Key, tempo, structure, melody profiling
├── engine/         # LLM strategy router and tool definitions
├── guardrails/     # Music theory validators (harmony, key, rhythm, range)
├── midi/           # MIDI I/O (parser, builder, merge)
├── models/         # Pydantic data models
├── patterns/       # Pattern generators (drums, bass, chords, piano)
├── web/            # FastAPI backend
└── cli.py          # Click CLI entry point

web/                # React + Tone.js frontend
knowledge/          # 8 music theory documents for RAG grounding
tests/              # Pytest suite
```

## Tech Stack

| | |
|-|-|
| **Backend** | Python 3.12+, mido, Pydantic v2, Click, FastAPI, NumPy |
| **Frontend** | React 19, TypeScript, Vite, Tone.js |
| **AI** | Anthropic Claude API (optional — falls back to rule-based strategy) |
| **Build** | uv, Hatch |

## Development

```bash
uv sync --extra dev      # install with dev dependencies
uv run pytest            # run tests
uv run ruff check src/   # lint
```

## License

MIT
