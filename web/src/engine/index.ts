/**
 * Music Arranger Engine
 *
 * Re-exports all engine modules for convenient access.
 */

export const ENGINE_VERSION = '0.1.0';

// Theory module
export {
  PITCH_CLASS_NAMES,
  PITCH_CLASS_NAMES_FLAT,
  MAJOR_PROFILE,
  MINOR_PROFILE,
  MODE_INTERVALS,
  pitchClassToName,
  nameToPitchClass,
  rotate,
  cosineSimilarity,
  parseRomanNumeral,
  getChordTones,
  scaleIntervals,
  resolveRomanToChord,
} from './theory';
export type { ParsedRomanNumeral } from './theory';

// Analysis module
export {
  pitchClassHistogram,
  estimateKey,
  inferBarCount,
  detectPhrases,
  detectPhrasesInfo,
  melodySummary,
} from './analysis';
export type { PhraseInfo, MelodySummary } from './analysis';

// Harmony module
export {
  STYLE_TEMPLATES,
  generateHarmony,
} from './harmony';
export type { ProgressionTemplate } from './harmony';

// GM Instruments module
export {
  GM_INSTRUMENTS,
  GM_PERCUSSION,
  GM_CATEGORIES,
  getGMInstrument,
  getGMPercussion,
  getGMInstrumentsByCategory,
  midiToNoteName,
} from './gm-instruments';
export type { GMInstrument, GMPercussion } from './gm-instruments';

// MIDI Generator module
export {
  arrangementToMidi,
  buildArrangement,
  generateBassLine,
  generateChordPad,
  generateArpeggio,
  generateDrumPattern,
  midiToBlob,
  downloadMidi,
  arrangementDuration,
} from './midi-generator';

// Playback Engine module
export { PlaybackEngine } from './playback';

// Gemini AI Arranger module
export { generateArrangementWithAI } from './gemini-arranger';

// File Parser module
export { parseFile, parseMidiFile, uploadFileToBackend, SUPPORTED_EXTENSIONS } from './file-parser';

// MusicXML Parser module
export { parseMusicXmlFile } from './musicxml-parser';

// Audio Parser module
export { parseAudioFile } from './audio-parser';
