/**
 * Key Detection & Analysis Module
 *
 * Ported from melody_architect/analysis.py.
 * Implements pitch class histogram computation, Krumhansl-Schmuckler key
 * estimation via cosine similarity, melody summary statistics, bar-count
 * inference, and phrase detection.
 */

import type { NoteEvent, KeyEstimate } from '../types/music';
import {
  MAJOR_PROFILE,
  MINOR_PROFILE,
  cosineSimilarity,
  pitchClassToName,
  rotate,
} from './theory';

// ---------------------------------------------------------------------------
// Phrase info returned by detectPhrases
// ---------------------------------------------------------------------------

export interface PhraseInfo {
  startSec: number;
  endSec: number;
  noteCount: number;
}

// ---------------------------------------------------------------------------
// Melody summary result
// ---------------------------------------------------------------------------

export interface MelodySummary {
  noteCount: number;
  rangeMin: number;
  rangeMax: number;
  rangeSpan: number;
  medianPitch: number;
  avgDurationSec: number;
  phrases: PhraseInfo[];
}

// ---------------------------------------------------------------------------
// Pitch Class Histogram
// ---------------------------------------------------------------------------

/**
 * Build a 12-element pitch class histogram from note events, weighted by
 * duration (minimum weight 0.05 to avoid zero-duration notes being ignored).
 */
export function pitchClassHistogram(notes: NoteEvent[]): number[] {
  const histogram = new Array<number>(12).fill(0);
  for (const note of notes) {
    const weight = Math.max(0.05, note.duration);
    histogram[note.pitch % 12] += weight;
  }
  return histogram;
}

// ---------------------------------------------------------------------------
// Key Estimation
// ---------------------------------------------------------------------------

/**
 * Estimate the key of a melody using the Krumhansl-Schmuckler algorithm.
 *
 * Builds a pitch class histogram from the notes, then computes cosine
 * similarity against rotated major and minor profiles for all 12 possible
 * tonics. Returns the best match.
 */
export function estimateKey(notes: NoteEvent[]): KeyEstimate {
  if (notes.length === 0) {
    return {
      tonicPc: 0,
      tonicName: 'C',
      mode: 'major',
      score: 0,
    };
  }

  const histogram = pitchClassHistogram(notes);

  type Candidate = { score: number; tonicPc: number; mode: 'major' | 'minor' };
  const candidates: Candidate[] = [];

  for (let tonic = 0; tonic < 12; tonic++) {
    const majorScore = cosineSimilarity(histogram, rotate(MAJOR_PROFILE, tonic));
    const minorScore = cosineSimilarity(histogram, rotate(MINOR_PROFILE, tonic));
    candidates.push({ score: majorScore, tonicPc: tonic, mode: 'major' });
    candidates.push({ score: minorScore, tonicPc: tonic, mode: 'minor' });
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  return {
    tonicPc: best.tonicPc,
    tonicName: pitchClassToName(best.tonicPc),
    mode: best.mode,
    score: best.score,
  };
}

// ---------------------------------------------------------------------------
// Bar Count Inference
// ---------------------------------------------------------------------------

/**
 * Infer the number of bars from a set of notes, given tempo and time
 * signature. Returns at least 1.
 */
export function inferBarCount(
  notes: NoteEvent[],
  tempoBpm: number,
  beatsPerBar: number,
): number {
  if (notes.length === 0) return 1;

  const beatSeconds = 60.0 / Math.max(1e-6, tempoBpm);
  const barSeconds = beatSeconds * beatsPerBar;

  let maxEnd = 0;
  for (const note of notes) {
    const end = note.start + note.duration;
    if (end > maxEnd) maxEnd = end;
  }

  return Math.max(1, Math.ceil(maxEnd / barSeconds));
}

// ---------------------------------------------------------------------------
// Phrase Detection
// ---------------------------------------------------------------------------

/**
 * Detect phrases by splitting notes at gaps exceeding 1.5 beats.
 * Returns an array of note-index groups (each group is a phrase).
 *
 * Also returns PhraseInfo objects with start/end times and note counts
 * when called via the `detectPhrasesInfo` variant.
 */
export function detectPhrases(notes: NoteEvent[], beatDuration: number): number[][] {
  if (notes.length === 0) return [];

  // Sort by start time, preserving original indices
  const indexed = notes.map((note, idx) => ({ note, idx }));
  indexed.sort((a, b) => a.note.start - b.note.start);

  const splitThreshold = 1.5 * beatDuration;
  const groups: number[][] = [];
  let currentGroup: number[] = [indexed[0].idx];

  for (let i = 1; i < indexed.length; i++) {
    const prevEnd = indexed[i - 1].note.start + indexed[i - 1].note.duration;
    const gap = indexed[i].note.start - prevEnd;
    if (gap >= splitThreshold) {
      groups.push(currentGroup);
      currentGroup = [indexed[i].idx];
    } else {
      currentGroup.push(indexed[i].idx);
    }
  }
  groups.push(currentGroup);

  return groups;
}

/**
 * Detect phrases and return PhraseInfo objects (matching Python's dict format).
 */
export function detectPhrasesInfo(notes: NoteEvent[], beatDuration: number): PhraseInfo[] {
  if (notes.length === 0) return [];

  const ordered = [...notes].sort((a, b) => a.start - b.start);
  const splitThreshold = 1.5 * beatDuration;

  const phrases: PhraseInfo[] = [];
  let phraseStart = ordered[0].start;
  let phraseEnd = ordered[0].start + ordered[0].duration;
  let phraseCount = 1;

  for (let i = 1; i < ordered.length; i++) {
    const prevEnd = ordered[i - 1].start + ordered[i - 1].duration;
    const gap = ordered[i].start - prevEnd;
    if (gap >= splitThreshold) {
      phrases.push({
        startSec: Math.round(phraseStart * 10000) / 10000,
        endSec: Math.round(phraseEnd * 10000) / 10000,
        noteCount: phraseCount,
      });
      phraseStart = ordered[i].start;
      phraseEnd = ordered[i].start + ordered[i].duration;
      phraseCount = 1;
    } else {
      phraseEnd = Math.max(phraseEnd, ordered[i].start + ordered[i].duration);
      phraseCount++;
    }
  }

  phrases.push({
    startSec: Math.round(phraseStart * 10000) / 10000,
    endSec: Math.round(phraseEnd * 10000) / 10000,
    noteCount: phraseCount,
  });

  return phrases;
}

// ---------------------------------------------------------------------------
// Melody Summary
// ---------------------------------------------------------------------------

/**
 * Compute summary statistics for a melody: pitch range, median pitch,
 * average note duration, and detected phrases.
 */
export function melodySummary(notes: NoteEvent[], tempoBpm: number): MelodySummary {
  if (notes.length === 0) {
    return {
      noteCount: 0,
      rangeMin: 0,
      rangeMax: 0,
      rangeSpan: 0,
      medianPitch: 0,
      avgDurationSec: 0,
      phrases: [],
    };
  }

  const sorted = [...notes].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  const beatSeconds = 60.0 / Math.max(1e-6, tempoBpm);

  const pitches = sorted.map((n) => n.pitch);
  const rangeMin = Math.min(...pitches);
  const rangeMax = Math.max(...pitches);
  const totalDuration = sorted.reduce((sum, n) => sum + n.duration, 0);

  // Median pitch
  const sortedPitches = [...pitches].sort((a, b) => a - b);
  const mid = Math.floor(sortedPitches.length / 2);
  const medianPitch =
    sortedPitches.length % 2 === 0
      ? Math.floor((sortedPitches[mid - 1] + sortedPitches[mid]) / 2)
      : sortedPitches[mid];

  return {
    noteCount: sorted.length,
    rangeMin,
    rangeMax,
    rangeSpan: rangeMax - rangeMin,
    medianPitch,
    avgDurationSec: Math.round((totalDuration / sorted.length) * 10000) / 10000,
    phrases: detectPhrasesInfo(sorted, beatSeconds),
  };
}
