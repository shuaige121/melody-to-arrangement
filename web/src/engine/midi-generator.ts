/**
 * MIDI File Generation
 *
 * Generates multi-track MIDI files from arrangements using @tonejs/midi.
 * Ported from the Python melody_architect.logic_export module with
 * style-aware pattern generation for bass, chord pads, arpeggios, and drums.
 */

import { Midi } from '@tonejs/midi';
import type { Arrangement, ArrangementTrack, Chord, NoteEvent } from '../types/music.ts';
import { getGMInstrument } from './gm-instruments.ts';
import { beatUnitSeconds, secondsPerBar } from './time-signature.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a value between min and max inclusive. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Seconds per beat at the given BPM. */
function beatSeconds(tempoBpm: number, beatUnit = 4): number {
  return beatUnitSeconds(tempoBpm, beatUnit);
}

/** Seconds per bar at the current time signature. */
function barSeconds(tempoBpm: number, beatsPerBar = 4, beatUnit = 4): number {
  return secondsPerBar(tempoBpm, beatsPerBar, beatUnit);
}

function primaryBeatIndices(beatsPerBar: number): number[] {
  if (beatsPerBar >= 6) return [0, Math.floor(beatsPerBar / 2)];
  if (beatsPerBar >= 4) return [0, 2];
  return [0];
}

function backbeatIndices(beatsPerBar: number): number[] {
  if (beatsPerBar >= 6) return [Math.floor(beatsPerBar / 2)];
  if (beatsPerBar === 3) return [1];
  return [1, 3].filter((beat) => beat < beatsPerBar);
}

// ---------------------------------------------------------------------------
// Pattern generators
// ---------------------------------------------------------------------------

/**
 * Generate bass line notes from a chord progression.
 *
 * - pop:   Root on every beat; fifth approaching next bar on beat 4
 * - jazz:  Root on beat 1; fifth on beats 2 and 4 (walking feel)
 * - modal: Root on beat 1, groove-locked with longer durations
 */
export function generateBassLine(
  chords: Chord[],
  tempoBpm: number,
  bars: number,
  style: string,
  beatsPerBar = 4,
  beatUnit = 4,
): NoteEvent[] {
  const beat = beatSeconds(tempoBpm, beatUnit);
  const notes: NoteEvent[] = [];
  const base = 36; // C2
  const strongBeats = new Set(primaryBeatIndices(beatsPerBar));

  for (let barIdx = 0; barIdx < bars; barIdx++) {
    const chord = chords[barIdx % chords.length];
    const barStart = barIdx * beatsPerBar * beat;
    const rootPitch = base + chord.rootPc;

    for (let b = 0; b < beatsPerBar; b++) {
      const start = barStart + b * beat;
      let pitch = rootPitch;
      let duration: number;

      if (style === 'jazz') {
        if (beatsPerBar >= 4 && (b === 1 || b === beatsPerBar - 1)) {
          pitch = rootPitch + 7;
        } else if (beatsPerBar >= 3 && b === Math.floor(beatsPerBar / 2)) {
          pitch = rootPitch + 5;
        }
        duration = beat * 0.85;
      } else if (style === 'modal') {
        if (!strongBeats.has(b)) {
          continue;
        }
        pitch = rootPitch;
        duration = beat * 1.8;
      } else {
        if (b === beatsPerBar - 1) {
          pitch = rootPitch + 2;
        }
        duration = beat * 0.8;
      }

      notes.push({
        pitch: clamp(pitch, 28, 60),
        start,
        duration,
        velocity: 82,
      });
    }
  }

  return notes;
}

/**
 * Generate chord pad notes from a chord progression.
 *
 * Block chords voiced in the C3-C5 range with smooth voice-leading.
 * Velocity is kept soft (~60-72) to sit underneath the melody.
 */
export function generateChordPad(
  chords: Chord[],
  tempoBpm: number,
  bars: number,
  style: string,
  beatsPerBar = 4,
  beatUnit = 4,
): NoteEvent[] {
  const beat = beatSeconds(tempoBpm, beatUnit);
  const notes: NoteEvent[] = [];

  for (let barIdx = 0; barIdx < bars; barIdx++) {
    const chord = chords[barIdx % chords.length];
    const start = barIdx * beatsPerBar * beat;
    const end = start + beatsPerBar * beat;
    const duration = end - start;

    // Take up to 3 chord tones and voice them in C3-C5 range
    const tones = chord.tones.slice(0, 3);
    const basePitch = 60; // C4
    let prevPitch = -1;

    for (let i = 0; i < tones.length; i++) {
      let pitch = basePitch + tones[i];
      // In jazz, raise the top voice an octave for open voicing
      if (style === 'jazz' && i === 2) {
        pitch += 12;
      }
      // Ensure ascending order: if this tone wrapped past the octave boundary
      // and ended up lower than the previous, shift it up an octave
      if (i > 0 && pitch <= prevPitch) {
        pitch += 12;
      }
      prevPitch = pitch;
      notes.push({
        pitch: clamp(pitch, 48, 84),
        start,
        duration,
        velocity: style === 'jazz' ? 60 : 68,
      });
    }
  }

  return notes;
}

/**
 * Generate an arpeggio pattern from chords.
 *
 * Cycles through chord tones in 8th note patterns. Every other pair
 * of notes is shifted up an octave for a wider arpeggio spread.
 */
export function generateArpeggio(
  chords: Chord[],
  tempoBpm: number,
  bars: number,
  beatsPerBar = 4,
  beatUnit = 4,
): NoteEvent[] {
  const barDuration = barSeconds(tempoBpm, beatsPerBar, beatUnit);
  const step = beatUnitSeconds(tempoBpm, 8);
  const notes: NoteEvent[] = [];

  for (let barIdx = 0; barIdx < bars; barIdx++) {
    const chord = chords[barIdx % chords.length];
    const bStart = barIdx * barDuration;
    const tones = chord.tones;

    const stepsPerBar = Math.max(1, Math.round(barDuration / step));
    for (let idx = 0; idx < stepsPerBar; idx++) {
      const tone = tones[idx % tones.length];
      const start = bStart + idx * step;
      // Shift notes in positions 2,3 (of each group of 4) up an octave
      const octaveShift = (idx % 4 >= 2) ? 12 : 0;
      const pitch = 60 + tone + octaveShift;

      notes.push({
        pitch: clamp(pitch, 52, 88),
        start,
        duration: step * 0.8,
        velocity: idx % 2 === 0 ? 70 : 64,
      });
    }
  }

  return notes;
}

/**
 * Generate a drum pattern.
 *
 * All drums are on MIDI channel 9 (General MIDI percussion).
 * Note numbers follow the GM percussion map:
 *   36 = Bass Drum 1
 *   38 = Acoustic Snare
 *   42 = Closed Hi-Hat
 *   46 = Open Hi-Hat
 *   51 = Ride Cymbal 1
 *
 * Patterns:
 * - pop:   kick on 1,3; snare on 2,4; closed hi-hat on all 8th notes
 * - jazz:  ride cymbal pattern; kick on 1; brush snare on 2,4
 * - modal: kick on 1; snare on 3; ghost notes on hi-hat with off-beat open hat
 */
export function generateDrumPattern(
  tempoBpm: number,
  bars: number,
  style: string,
  beatsPerBar = 4,
  beatUnit = 4,
): NoteEvent[] {
  const beat = beatSeconds(tempoBpm, beatUnit);
  const notes: NoteEvent[] = [];
  const strongBeats = new Set(primaryBeatIndices(beatsPerBar));
  const backbeats = new Set(backbeatIndices(beatsPerBar));

  for (let barIdx = 0; barIdx < bars; barIdx++) {
    const bStart = barIdx * beatsPerBar * beat;

    if (style === 'jazz') {
      // Jazz: ride pattern, kick on 1, brush snare on 2 and 4
      for (let b = 0; b < beatsPerBar; b++) {
        const start = bStart + b * beat;

        // Ride cymbal on every beat
        notes.push({ pitch: 51, start, duration: beat * 0.4, velocity: 75 });
        // Ride "skip" note (swung 8th)
        const skipStart = start + beat * 0.66;
        notes.push({ pitch: 51, start: skipStart, duration: beat * 0.2, velocity: 55 });

        // Kick on beat 1
        if (strongBeats.has(b)) {
          notes.push({ pitch: 36, start, duration: 0.08, velocity: 85 });
        }
        if (backbeats.has(b)) {
          notes.push({ pitch: 38, start, duration: 0.08, velocity: 65 });
        }
      }
    } else if (style === 'modal') {
      for (let b = 0; b < beatsPerBar; b++) {
        const start = bStart + b * beat;

        if (strongBeats.has(b)) {
          notes.push({ pitch: 36, start, duration: 0.08, velocity: 95 });
        }
        if (backbeats.has(b)) {
          notes.push({ pitch: 38, start, duration: 0.08, velocity: 90 });
        }
        notes.push({ pitch: 42, start, duration: 0.05, velocity: 64 });
        const offBeat = start + beat * 0.5;
        notes.push({ pitch: 42, start: offBeat, duration: 0.05, velocity: 48 });
      }
    } else {
      for (let b = 0; b < beatsPerBar; b++) {
        const start = bStart + b * beat;

        if (strongBeats.has(b)) {
          notes.push({ pitch: 36, start, duration: 0.08, velocity: 95 });
        }
        if (backbeats.has(b)) {
          notes.push({ pitch: 38, start, duration: 0.08, velocity: 90 });
        }
        notes.push({ pitch: 42, start, duration: 0.05, velocity: 64 });
        const andStart = start + beat * 0.5;
        notes.push({ pitch: 42, start: andStart, duration: 0.05, velocity: 58 });
      }
    }
  }

  return notes;
}

// ---------------------------------------------------------------------------
// MIDI generation from Arrangement
// ---------------------------------------------------------------------------

/**
 * Generate a complete MIDI file from an Arrangement.
 *
 * Each ArrangementTrack is written to a separate MIDI track with the
 * correct channel, program number, and note events.
 */
export function arrangementToMidi(arrangement: Arrangement): Midi {
  const midi = new Midi();

  midi.header.setTempo(arrangement.tempoBpm);
  midi.header.timeSignatures.push({
    ticks: 0,
    timeSignature: [arrangement.beatsPerBar, arrangement.beatUnit],
  });

  for (const arrTrack of arrangement.tracks) {
    const track = midi.addTrack();
    track.name = arrTrack.name;
    track.channel = arrTrack.channel;

    // Set the instrument program number
    track.instrument.number = arrTrack.program;

    // Add all notes
    for (const note of arrTrack.notes) {
      track.addNote({
        midi: clamp(note.pitch, 0, 127),
        time: Math.max(0, note.start),
        duration: Math.max(0.01, note.duration),
        velocity: clamp(note.velocity / 127, 0, 1),
      });
    }
  }

  return midi;
}

/**
 * Build a complete Arrangement with auto-generated accompaniment tracks
 * from melody notes and a chord progression.
 */
export function buildArrangement(
  melodyNotes: NoteEvent[],
  chords: Chord[],
  tempoBpm: number,
  bars: number,
  style: 'pop' | 'modal' | 'jazz',
  complexity: 'basic' | 'rich' = 'basic',
  beatsPerBar = 4,
  beatUnit = 4,
): Arrangement {
  const tracks: ArrangementTrack[] = [];

  // Lead melody
  const leadProgram = style === 'pop' ? 80 : style === 'jazz' ? 65 : 28;
  tracks.push({
    name: 'Lead Melody',
    instrument: getGMInstrument(leadProgram)?.name ?? 'Unknown',
    channel: 0,
    program: leadProgram,
    notes: melodyNotes,
  });

  // Bass
  const bassNotes = generateBassLine(chords, tempoBpm, bars, style, beatsPerBar, beatUnit);
  tracks.push({
    name: 'Bass',
    instrument: 'Electric Bass (finger)',
    channel: 1,
    program: 33,
    notes: bassNotes,
  });

  // Chord pad / Harmony
  const padNotes = generateChordPad(chords, tempoBpm, bars, style, beatsPerBar, beatUnit);
  const padProgram = style === 'modal' ? 4 : 0;
  tracks.push({
    name: 'Harmony',
    instrument: style === 'modal' ? 'Electric Piano 1' : 'Acoustic Grand Piano',
    channel: 2,
    program: padProgram,
    notes: padNotes,
  });

  // Drums
  const drumNotes = generateDrumPattern(tempoBpm, bars, style, beatsPerBar, beatUnit);
  tracks.push({
    name: 'Drums',
    instrument: 'Drum Kit',
    channel: 9,
    program: 0,
    notes: drumNotes,
  });

  // Rich complexity: add arpeggio track
  if (complexity === 'rich') {
    const arpNotes = generateArpeggio(chords, tempoBpm, bars, beatsPerBar, beatUnit);
    const arpProgram = style === 'modal' ? 4 : 0;
    tracks.push({
      name: 'Arp Keys',
      instrument: style === 'modal' ? 'Electric Piano 1' : 'Acoustic Grand Piano',
      channel: 3,
      program: arpProgram,
      notes: arpNotes,
    });
  }

  return {
    tracks,
    tempoBpm,
    beatsPerBar,
    beatUnit,
    bars,
    style,
    complexity,
  };
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Midi object to a downloadable Blob.
 */
export function midiToBlob(midi: Midi): Blob {
  const array = midi.toArray();
  return new Blob([new Uint8Array(array)], { type: 'audio/midi' });
}

/**
 * Trigger a browser download of a MIDI file.
 */
export function downloadMidi(midi: Midi, filename: string): void {
  const blob = midiToBlob(midi);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.mid') ? filename : `${filename}.mid`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Utility: compute total arrangement duration
// ---------------------------------------------------------------------------

/**
 * Calculate the total duration of an arrangement in seconds.
 */
export function arrangementDuration(arrangement: Arrangement): number {
  return arrangement.bars * barSeconds(arrangement.tempoBpm, arrangement.beatsPerBar, arrangement.beatUnit);
}
