/**
 * Music Theory Module
 *
 * Ported from melody_architect/theory.py.
 * Implements pitch class utilities, Krumhansl-Schmuckler key-finding profiles,
 * Roman numeral parsing, chord resolution, and mode interval definitions.
 */

import type { Chord } from '../types/music';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Pitch class names using sharps. */
export const PITCH_CLASS_NAMES: readonly string[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
];

/** Pitch class names using flats. */
export const PITCH_CLASS_NAMES_FLAT: readonly string[] = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
];

/** Krumhansl-Schmuckler major key profile weights. */
export const MAJOR_PROFILE: readonly number[] = [
  6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
];

/** Krumhansl-Schmuckler minor key profile weights. */
export const MINOR_PROFILE: readonly number[] = [
  6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
];

/** Semitone intervals for common modes/scales. */
export const MODE_INTERVALS: ReadonlyMap<string, readonly number[]> = new Map([
  ['major', [0, 2, 4, 5, 7, 9, 11]],
  ['minor', [0, 2, 3, 5, 7, 8, 10]],
  ['dorian', [0, 2, 3, 5, 7, 9, 10]],
  ['mixolydian', [0, 2, 4, 5, 7, 9, 10]],
]);

/** Mapping of upper-case Roman numeral strings to scale degrees (1-based). */
const ROMAN_TO_DEGREE: ReadonlyMap<string, number> = new Map([
  ['I', 1],
  ['II', 2],
  ['III', 3],
  ['IV', 4],
  ['V', 5],
  ['VI', 6],
  ['VII', 7],
]);

/** Interval sets for chord qualities (semitones above root). */
const CHORD_TONE_INTERVALS: ReadonlyMap<string, readonly number[]> = new Map([
  ['major', [0, 4, 7]],
  ['minor', [0, 3, 7]],
  ['dim', [0, 3, 6]],
  ['dominant7', [0, 4, 7, 10]],
  ['maj7', [0, 4, 7, 11]],
  ['min7', [0, 3, 7, 10]],
]);

/** Regex for parsing Roman numeral tokens such as "bVII7" or "ii7". */
const ROMAN_PATTERN = /^(?<accidental>[b#]?)(?<roman>[ivIV]+)(?<suffix>.*)$/;

// ---------------------------------------------------------------------------
// Parsed Roman Numeral
// ---------------------------------------------------------------------------

export interface ParsedRomanNumeral {
  degree: number;
  flat: boolean;
  sharp: boolean;
  suffix: string;
  loweredCase: boolean;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Convert a pitch class (0-11) to its name, using sharps by default.
 */
export function pitchClassToName(pc: number, preferFlats = false): string {
  const names = preferFlats ? PITCH_CLASS_NAMES_FLAT : PITCH_CLASS_NAMES;
  return names[((pc % 12) + 12) % 12];
}

/**
 * Convert a note name (e.g. "C#", "Db") to its pitch class (0-11).
 * Throws if the name is not recognised.
 */
export function nameToPitchClass(name: string): number {
  const token = name.trim().replace('\u266D', 'b').replace('\u266F', '#');
  const sharpIdx = PITCH_CLASS_NAMES.indexOf(token);
  if (sharpIdx !== -1) return sharpIdx;
  const flatIdx = PITCH_CLASS_NAMES_FLAT.indexOf(token);
  if (flatIdx !== -1) return flatIdx;
  throw new Error(`Unsupported note name: ${name}`);
}

/**
 * Rotate an array by `shift` positions (used to align profiles with a tonic).
 */
export function rotate(values: readonly number[], shift: number): number[] {
  const size = values.length;
  return Array.from({ length: size }, (_, idx) => values[((idx - shift) % size + size) % size]);
}

/**
 * Cosine similarity between two numeric vectors of equal length.
 */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  na = Math.sqrt(na);
  nb = Math.sqrt(nb);
  if (na === 0 || nb === 0) return 0;
  return dot / (na * nb);
}

// ---------------------------------------------------------------------------
// Roman Numeral Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a Roman numeral token (e.g. "bVII7", "ii7", "Imaj7") into its
 * constituent parts: scale degree, accidental, suffix, and case.
 */
export function parseRomanNumeral(token: string): ParsedRomanNumeral {
  const text = token.trim();
  const match = ROMAN_PATTERN.exec(text);
  if (!match || !match.groups) {
    throw new Error(`Invalid roman numeral token: ${token}`);
  }

  const accidentalPrefix = match.groups['accidental'];
  const roman = match.groups['roman'];
  const suffix = match.groups['suffix'] ?? '';

  const upperRoman = roman.toUpperCase();
  const degree = ROMAN_TO_DEGREE.get(upperRoman);
  if (degree === undefined) {
    throw new Error(`Unsupported roman numeral: ${token}`);
  }

  return {
    degree,
    flat: accidentalPrefix === 'b',
    sharp: accidentalPrefix === '#',
    suffix,
    loweredCase: roman === roman.toLowerCase(),
  };
}

// ---------------------------------------------------------------------------
// Chord Quality Inference
// ---------------------------------------------------------------------------

/**
 * Infer chord quality from a parsed Roman numeral token.
 */
function inferChordQuality(parsed: ParsedRomanNumeral): string {
  const suffix = parsed.suffix.toLowerCase();
  if (suffix.includes('dim') || suffix.includes('\u00B0')) return 'dim';
  if (suffix.includes('maj7')) return 'maj7';
  if (suffix.startsWith('m7')) return 'min7';
  if (suffix === '7') return parsed.loweredCase ? 'min7' : 'dominant7';
  if (parsed.loweredCase) return 'minor';
  return 'major';
}

// ---------------------------------------------------------------------------
// Chord Tone Retrieval
// ---------------------------------------------------------------------------

/**
 * Return the pitch classes of chord tones given a root pitch class and quality.
 */
export function getChordTones(rootPc: number, quality: string): number[] {
  const intervals = CHORD_TONE_INTERVALS.get(quality);
  if (!intervals) {
    throw new Error(`Unsupported chord quality: ${quality}`);
  }
  return intervals.map((interval) => (rootPc + interval) % 12);
}

// ---------------------------------------------------------------------------
// Scale Intervals
// ---------------------------------------------------------------------------

/**
 * Retrieve the semitone intervals for a given mode.
 */
export function scaleIntervals(mode: string): readonly number[] {
  const intervals = MODE_INTERVALS.get(mode);
  if (!intervals) {
    throw new Error(`Unsupported mode: ${mode}`);
  }
  return intervals;
}

// ---------------------------------------------------------------------------
// Chord Symbol Generation
// ---------------------------------------------------------------------------

/**
 * Build a human-readable chord symbol from a root name and quality.
 */
function chordSymbol(rootName: string, quality: string): string {
  switch (quality) {
    case 'major':
      return rootName;
    case 'minor':
      return `${rootName}m`;
    case 'dim':
      return `${rootName}dim`;
    case 'dominant7':
      return `${rootName}7`;
    case 'maj7':
      return `${rootName}maj7`;
    case 'min7':
      return `${rootName}m7`;
    default:
      throw new Error(`Unsupported chord quality: ${quality}`);
  }
}

// ---------------------------------------------------------------------------
// Resolve Roman Numeral to Chord
// ---------------------------------------------------------------------------

/**
 * Resolve a Roman numeral token (e.g. "IV", "bVII7") to a fully specified
 * Chord object, given a tonic pitch class and mode.
 */
export function resolveRomanToChord(token: string, tonicPc: number, mode: string): Chord {
  const parsed = parseRomanNumeral(token);
  const intervals = scaleIntervals(mode);
  const accidental = parsed.flat ? -1 : parsed.sharp ? 1 : 0;
  const rootPc = ((tonicPc + intervals[parsed.degree - 1] + accidental) % 12 + 12) % 12;
  const quality = inferChordQuality(parsed);
  const tones = getChordTones(rootPc, quality);
  const preferFlats = token.includes('b');
  const rootName = pitchClassToName(rootPc, preferFlats);
  return {
    rootPc,
    rootName,
    quality,
    symbol: chordSymbol(rootName, quality),
    roman: token,
    tones,
  };
}
