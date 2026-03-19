/**
 * Harmony Generation Module
 *
 * Ported from melody_architect/harmony.py.
 * Defines chord progression style templates, scores candidate progressions
 * against a melody by chord-tone and strong-beat coverage, and returns
 * ranked harmony candidates.
 */

import type { NoteEvent, KeyEstimate, Chord, HarmonyCandidate } from '../types/music';
import { resolveRomanToChord } from './theory';
import { beatUnitSeconds, secondsPerBar } from './time-signature';

// ---------------------------------------------------------------------------
// Progression Template
// ---------------------------------------------------------------------------

export interface ProgressionTemplate {
  name: string;
  tokens: readonly string[];
  mode: string;
}

// ---------------------------------------------------------------------------
// Style Templates
// ---------------------------------------------------------------------------

/** Built-in chord progression templates grouped by style. */
export const STYLE_TEMPLATES: Readonly<Record<string, readonly ProgressionTemplate[]>> = {
  pop: [
    { name: 'pop_primary', tokens: ['I', 'V', 'vi', 'IV'], mode: 'major' },
    { name: 'pop_alt', tokens: ['I', 'vi', 'IV', 'V'], mode: 'major' },
    { name: 'pop_desc', tokens: ['vi', 'IV', 'I', 'V'], mode: 'major' },
    { name: 'pop_minor', tokens: ['i', 'VII', 'VI', 'VII'], mode: 'minor' },
  ],
  modal: [
    { name: 'modal_dorian', tokens: ['i7', 'IV7'], mode: 'dorian' },
    { name: 'modal_mixolydian', tokens: ['I7', 'VII7'], mode: 'mixolydian' },
  ],
  jazz: [
    { name: 'jazz_ii_v_i', tokens: ['ii7', 'V7', 'Imaj7'], mode: 'major' },
    { name: 'jazz_cycle', tokens: ['ii7', 'V7', 'Imaj7', 'VI7'], mode: 'major' },
  ],
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Cycle through template tokens to fill the requested number of bars.
 */
function cycleTokens(tokens: readonly string[], bars: number): string[] {
  if (bars <= 0) return [];
  return Array.from({ length: bars }, (_, idx) => tokens[idx % tokens.length]);
}

/**
 * Group notes into bars based on bar duration in seconds.
 */
function notesByBar(notes: NoteEvent[], barSeconds: number, barCount: number): NoteEvent[][] {
  const count = Math.max(1, barCount);
  const grouped: NoteEvent[][] = Array.from({ length: count }, () => []);
  for (const note of notes) {
    let idx = Math.floor(note.start / barSeconds);
    if (idx < 0) idx = 0;
    if (idx >= count) idx = count - 1;
    grouped[idx].push(note);
  }
  return grouped;
}

/**
 * Determine whether a note falls on a strong beat within its bar.
 */
function isStrongBeat(
  note: NoteEvent,
  barIdx: number,
  barSeconds: number,
  beatSeconds: number,
  beatsPerBar: number,
): boolean {
  const barStart = barIdx * barSeconds;
  const beatPosition = (note.start - barStart) / beatSeconds;
  const nearest = Math.round(beatPosition);
  const onGrid = Math.abs(beatPosition - nearest) <= 0.2;
  const strongBeats = new Set<number>([0]);
  if (beatsPerBar >= 4) {
    strongBeats.add(Math.floor(beatsPerBar / 2));
  }
  return onGrid && strongBeats.has(((nearest % beatsPerBar) + beatsPerBar) % beatsPerBar);
}

/**
 * Score a chord progression against grouped notes.
 *
 * Returns [totalScore, chordToneCoverage, strongBeatCoverage].
 */
function scoreProgression(
  chords: Chord[],
  notesGrouped: NoteEvent[][],
  beatsPerBar: number,
  tempoBpm: number,
  beatUnit: number,
): [number, number, number] {
  const beatSeconds = beatUnitSeconds(tempoBpm, beatUnit);
  const barSeconds = secondsPerBar(tempoBpm, beatsPerBar, beatUnit);

  let totalNotes = 0;
  let chordToneHits = 0;
  let strongTotal = 0;
  let strongHits = 0;
  let score = 0;

  for (let barIdx = 0; barIdx < notesGrouped.length; barIdx++) {
    const barNotes = notesGrouped[barIdx];
    const chord = chords[Math.min(barIdx, chords.length - 1)];
    const tones = new Set(chord.tones);

    for (const note of barNotes) {
      totalNotes++;
      const strong = isStrongBeat(note, barIdx, barSeconds, beatSeconds, beatsPerBar);
      const inChord = tones.has(note.pitch % 12);

      if (strong) strongTotal++;

      if (inChord) {
        chordToneHits++;
        if (strong) {
          strongHits++;
          score += 2.0;
        } else {
          score += 1.0;
        }
      } else {
        if (strong) {
          score -= 2.0;
        } else {
          score -= 0.75;
        }
      }
    }
  }

  const coverage = totalNotes > 0 ? chordToneHits / totalNotes : 0;
  const strongCoverage = strongTotal > 0 ? strongHits / strongTotal : 0;
  score += coverage * 8.0 + strongCoverage * 6.0;
  return [score, coverage, strongCoverage];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate harmony candidates for a given melody, key, bar count, and style.
 *
 * For each template matching the requested style, the template tokens are
 * cycled to fill the bar count, resolved to Chord objects, and scored
 * against the melody. Returns the top 3 candidates sorted by score.
 */
export function generateHarmony(
  notes: NoteEvent[],
  key: KeyEstimate,
  bars: number,
  style: string,
  beatsPerBar = 4,
  tempoBpm = 120,
  beatUnit = 4,
): HarmonyCandidate[] {
  const templateList = STYLE_TEMPLATES[style];
  if (!templateList) {
    throw new Error(`Unsupported style: ${style}`);
  }

  if (notes.length === 0 || bars <= 0) {
    return [];
  }

  const barSeconds = secondsPerBar(tempoBpm, beatsPerBar, beatUnit);
  const grouped = notesByBar(notes, barSeconds, bars);

  const candidates: HarmonyCandidate[] = [];

  for (const template of templateList) {
    const mode = template.mode || key.mode;
    const romans = cycleTokens(template.tokens, bars);
    const chordBars = romans.map((token) => resolveRomanToChord(token, key.tonicPc, mode));
    const [score, coverage, strongCoverage] = scoreProgression(
      chordBars,
      grouped,
      beatsPerBar,
      tempoBpm,
      beatUnit,
    );

    candidates.push({
      name: template.name,
      mode,
      bars: chordBars,
      score: Math.round(score * 10000) / 10000,
      chordToneCoverage: Math.round(coverage * 10000) / 10000,
      strongBeatCoverage: Math.round(strongCoverage * 10000) / 10000,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 3);
}
