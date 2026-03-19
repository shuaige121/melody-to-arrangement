import { Midi } from '@tonejs/midi';

import type { Arrangement, ArrangementTrack, NoteEvent } from '../types/music.ts';
import { getGMInstrument } from './gm-instruments.ts';
import { secondsPerBar } from './time-signature.ts';

type WebStyle = Arrangement['style'];
type ArrangementComplexity = Arrangement['complexity'];

const BACKEND_STYLE_MAP: Record<WebStyle, 'pop' | 'jazz' | null> = {
  pop: 'pop',
  jazz: 'jazz',
  modal: null,
};

function resolveBackendBaseUrl(): string {
  const configured = import.meta.env.VITE_BACKEND_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    if (!import.meta.env.DEV) {
      return window.location.origin.replace(/\/+$/, '');
    }
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }

  return 'http://localhost:8000';
}

function midiTrackToArrangementTrack(track: Midi['tracks'][number]): ArrangementTrack {
  const program = track.channel === 9 ? 0 : track.instrument.number;
  const instrument = track.channel === 9
    ? 'Standard Drum Kit'
    : getGMInstrument(program)?.name ?? track.instrument.name ?? `Program ${program}`;

  return {
    name: track.name || (track.channel === 9 ? 'Drums' : `Track ${track.channel + 1}`),
    instrument,
    channel: track.channel,
    program,
    notes: track.notes.map((note) => ({
      pitch: note.midi,
      start: note.time,
      duration: note.duration,
      velocity: Math.round(note.velocity * 127),
    })),
  };
}

export function backendStyleForWebStyle(style: WebStyle): 'pop' | 'jazz' | null {
  return BACKEND_STYLE_MAP[style] ?? null;
}

export function serializeMelodyToMidi(
  melody: NoteEvent[],
  tempoBpm: number,
  beatsPerBar: number,
  beatUnit: number,
): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(tempoBpm);
  midi.header.timeSignatures.push({
    ticks: 0,
    timeSignature: [beatsPerBar, beatUnit],
  });

  const track = midi.addTrack();
  track.name = 'Lead Melody';
  track.channel = 0;
  track.instrument.number = 80;

  for (const note of melody) {
    track.addNote({
      midi: Math.max(0, Math.min(127, note.pitch)),
      time: Math.max(0, note.start),
      duration: Math.max(0.01, note.duration),
      velocity: Math.max(0, Math.min(1, note.velocity / 127)),
    });
  }

  return new Uint8Array(midi.toArray());
}

export function parseArrangementMidi(
  bytes: Uint8Array,
  style: WebStyle,
  complexity: ArrangementComplexity,
): Arrangement {
  const midi = new Midi(bytes);
  const tempoBpm = midi.header.tempos[0]?.bpm ?? 120;
  const rawTimeSignature = midi.header.timeSignatures[0]?.timeSignature;
  const beatsPerBar = Array.isArray(rawTimeSignature) && rawTimeSignature.length === 2 ? rawTimeSignature[0] : 4;
  const beatUnit = Array.isArray(rawTimeSignature) && rawTimeSignature.length === 2 ? rawTimeSignature[1] : 4;

  const tracks = midi.tracks
    .filter((track) => track.notes.length > 0)
    .map(midiTrackToArrangementTrack);

  const maxEnd = tracks.reduce((trackMax, track) => {
    const trackEnd = track.notes.reduce(
      (noteMax, note) => Math.max(noteMax, note.start + note.duration),
      0,
    );
    return Math.max(trackMax, trackEnd);
  }, 0);

  const bars = Math.max(1, Math.ceil(maxEnd / secondsPerBar(tempoBpm, beatsPerBar, beatUnit)));
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

export async function generateArrangementWithBackend(
  melody: NoteEvent[],
  tempoBpm: number,
  beatsPerBar: number,
  beatUnit: number,
  style: WebStyle,
  complexity: ArrangementComplexity,
): Promise<Arrangement> {
  const backendStyle = backendStyleForWebStyle(style);
  if (!backendStyle) {
    throw new Error(`Backend arranger does not support style '${style}'.`);
  }

  const payload = serializeMelodyToMidi(melody, tempoBpm, beatsPerBar, beatUnit);
  const filePayload = new Uint8Array(payload.byteLength);
  filePayload.set(payload);
  const file = new File([filePayload], 'melody.mid', { type: 'audio/midi' });
  const formData = new FormData();
  formData.append('file', file);
  formData.append('style', backendStyle);
  formData.append('mood', 'neutral');

  const response = await fetch(`${resolveBackendBaseUrl()}/api/arrange`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => null);
    const detail = typeof errorJson?.detail === 'string'
      ? errorJson.detail
      : `Backend arranger failed (${response.status})`;
    throw new Error(detail);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  return parseArrangementMidi(bytes, style, complexity);
}
