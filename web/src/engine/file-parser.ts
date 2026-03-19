/**
 * File Parser
 *
 * Parses uploaded music files into NoteEvent arrays.
 * - MIDI files: parsed client-side using @tonejs/midi
 * - MusicXML files: parsed client-side
 * - Audio files: parsed client-side using a lightweight monophonic estimator
 */

import { Midi } from '@tonejs/midi';
import type { NoteEvent } from '../types/music.ts';
import { parseMusicXmlFile } from './musicxml-parser.ts';
import { parseAudioFile } from './audio-parser.ts';
import { formatTimeSignature } from './time-signature.ts';

// ---------------------------------------------------------------------------
// MIDI client-side parsing
// ---------------------------------------------------------------------------

/**
 * Parse a MIDI file (.mid/.midi) in the browser and extract notes.
 * Returns { notes, tempoBpm } or throws on error.
 */
export async function parseMidiFile(file: File): Promise<{ notes: NoteEvent[]; tempoBpm: number; timeSignature?: string }> {
  const buffer = await file.arrayBuffer();
  const midi = new Midi(new Uint8Array(buffer));

  const tempoBpm = midi.header.tempos.length > 0
    ? midi.header.tempos[0].bpm
    : 120;
  const rawTimeSignature = midi.header.timeSignatures[0]?.timeSignature;
  const timeSignature = Array.isArray(rawTimeSignature) && rawTimeSignature.length === 2
    ? formatTimeSignature(rawTimeSignature[0], rawTimeSignature[1])
    : undefined;

  const notes: NoteEvent[] = [];

  for (const track of midi.tracks) {
    for (const note of track.notes) {
      notes.push({
        pitch: note.midi,
        start: note.time,
        duration: note.duration,
        velocity: Math.round(note.velocity * 127),
      });
    }
  }

  // Sort by start time
  notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);

  return { notes, tempoBpm, timeSignature };
}

// ---------------------------------------------------------------------------
// Unified file handler
// ---------------------------------------------------------------------------

const MIDI_EXTENSIONS = new Set(['.mid', '.midi']);
const MUSICXML_EXTENSIONS = new Set(['.xml', '.musicxml', '.mxl']);
const AUDIO_EXTENSIONS = new Set(['.wav', '.aif', '.aiff', '.mp3', '.flac', '.ogg', '.aac', '.m4a', '.wma', '.opus']);

/** All supported file extensions. */
export const SUPPORTED_EXTENSIONS = [
  '.mid', '.midi',
  '.wav', '.aif', '.aiff',
  '.mp3', '.flac', '.ogg', '.aac', '.m4a', '.wma', '.opus',
  '.xml', '.musicxml', '.mxl',
];

/**
 * Parse any supported music file.
 * Supported formats are parsed client-side in this build.
 */
export async function parseFile(
  file: File,
): Promise<{ notes: NoteEvent[]; tempoBpm: number; timeSignature?: string; source: 'client' }> {
  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');

  if (MIDI_EXTENSIONS.has(ext)) {
    const result = await parseMidiFile(file);
    return { ...result, source: 'client' };
  }

  if (MUSICXML_EXTENSIONS.has(ext)) {
    const result = await parseMusicXmlFile(file);
    return { ...result, source: 'client' };
  }

  if (AUDIO_EXTENSIONS.has(ext)) {
    const result = await parseAudioFile(file);
    return { ...result, source: 'client' };
  }

  throw new Error(`Unsupported file format: ${ext}`);
}
