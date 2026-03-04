# Logic Pro Audio Arranger

AI-powered MIDI arrangement engine with music theory guardrails. Feed it a melody MIDI — get back a full multi-track arrangement with drums, bass, piano, and chords.

**Rule-constrained LLM + classical music theory = arrangements that actually sound right.**

## Features

- **Melody Analysis** — automatic key detection, tempo estimation, phrase segmentation, structure recognition
- **Smart Arrangement** — LLM-guided strategy selection with rule-based pattern generation for drums, bass, piano, and chords
- **Music Theory Guardrails** — key constraints, harmony validation, rhythm checks, range guards ensure musically correct output
- **9 Styles** — Pop, Rock, Ballad, Jazz, EDM, R&B, Latin, Funk, Country
- **6 Moods** — Happy, Sad, Energetic, Chill, Epic, Neutral
- **Web DAW UI** — Logic Pro-style browser interface built with React + Tone.js ([live demo](https://zhouruby.com/arranger/))
- **CLI + API** — Click CLI for batch processing, FastAPI server for integration
- **Knowledge Base** — 8 curated music theory documents covering harmony, rhythm, composition, and MIDI toolchains

## How It Works

```
Input MIDI → Melody Analysis → LLM Strategy Router → Pattern Generation → Guardrail Validation → Output MIDI
```

### 4-Layer Pipeline

| Layer | Module | Role |
|-------|--------|------|
| **Analysis** | `arranger.analysis` | Key detection, tempo, structure, melody profiling |
| **Strategy** | `arranger.engine.llm` | LLM selects style-appropriate progression, drum pattern, bass/piano style |
| **Patterns** | `arranger.patterns` | Rule-based generators for drums, bass, chords, piano accompaniment |
| **Guardrails** | `arranger.guardrails` | Post-generation validation: harmony, key, rhythm, range constraints |

## Quick Start

### Install

```bash
git clone https://github.com/shuaige121/logic-pro-audio-arranger.git
cd logic-pro-audio-arranger
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

### Start the web server

```bash
arranger serve
```

### List available styles

```bash
arranger styles
```

## Web UI

The browser-based DAW interface lives in `web/` — built with React 19, TypeScript, Vite, and Tone.js.

```bash
cd web
npm install
npm run dev
```

Production build deployed at [zhouruby.com/arranger](https://zhouruby.com/arranger/) as part of Ruby's Music Rainforest.

## Project Structure

```
src/arranger/
├── analysis/       # Melody analysis (key, tempo, structure)
├── engine/         # Arrangement engine (LLM strategy, tool definitions)
├── guardrails/     # Music theory validators (harmony, key, rhythm, range)
├── midi/           # MIDI I/O (parser, builder, merge)
├── models/         # Pydantic data models (Note, Pattern, Arrangement, Guardrail)
├── patterns/       # Pattern generators (drums, bass, chords, piano)
├── web/            # FastAPI backend
└── cli.py          # Click CLI entry point

web/                # React + Tone.js DAW frontend
knowledge/          # Music theory knowledge base (8 topics + RAG database)
tests/              # Pytest suite
```

## Knowledge Base

Curated music theory references used for RAG and LLM grounding:

1. 实用乐理基础 — Practical Music Theory
2. 和声与和弦进行 — Harmony & Chord Progressions
3. 节奏与鼓组模式 — Rhythm & Drum Patterns
4. 编曲理论与实践 — Arrangement Theory & Practice
5. MIDI编曲与工具链 — MIDI Arrangement & Toolchain
6. 音频转MIDI工具 — Audio-to-MIDI Tools
7. RAG数据库设计方案 — RAG Database Design
8. 项目架构设计 — Project Architecture

## Tech Stack

**Backend:** Python 3.12+, mido, Pydantic v2, Click, FastAPI, NumPy

**Frontend:** React 19, TypeScript, Vite, Tone.js

**AI:** Anthropic Claude API (optional — falls back to rule-based strategy)

**Build:** Hatch, uv

## Development

```bash
# Install with dev dependencies
uv sync --extra dev

# Run tests
uv run pytest

# Lint
uv run ruff check src/ tests/
```

## License

MIT
