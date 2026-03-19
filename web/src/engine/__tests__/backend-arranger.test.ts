// @vitest-environment node
import { Midi } from '@tonejs/midi';
import { describe, expect, it } from 'vitest';

import {
  backendStyleForWebStyle,
  parseArrangementMidi,
  serializeMelodyToMidi,
} from '../backend-arranger.ts';

describe('backend arranger bridge', () => {
  it('serializes a melody MIDI payload with tempo and time signature metadata', () => {
    const bytes = serializeMelodyToMidi(
      [{ pitch: 60, start: 0, duration: 0.5, velocity: 96 }],
      120,
      6,
      8,
    );

    const midi = new Midi(bytes);
    expect(midi.header.tempos[0]?.bpm).toBe(120);
    expect(midi.header.timeSignatures[0]?.timeSignature).toEqual([6, 8]);
    expect(midi.tracks[0]?.notes[0]?.midi).toBe(60);
  });

  it('parses backend arrangement MIDI into the shared Arrangement shape', () => {
    const midi = new Midi();
    midi.header.setTempo(120);
    midi.header.timeSignatures.push({ ticks: 0, timeSignature: [3, 4] });

    const bass = midi.addTrack();
    bass.name = 'Bass';
    bass.channel = 1;
    bass.instrument.number = 33;
    bass.addNote({ midi: 36, time: 0, duration: 0.5, velocity: 0.8 });

    const piano = midi.addTrack();
    piano.name = 'Piano';
    piano.channel = 2;
    piano.instrument.number = 0;
    piano.addNote({ midi: 60, time: 1.6, duration: 0.5, velocity: 0.7 });

    const arrangement = parseArrangementMidi(new Uint8Array(midi.toArray()), 'pop', 'basic');

    expect(arrangement.beatsPerBar).toBe(3);
    expect(arrangement.beatUnit).toBe(4);
    expect(arrangement.bars).toBe(2);
    expect(arrangement.tracks.map((track) => track.name)).toEqual(['Bass', 'Piano']);
    expect(arrangement.tracks[0]?.instrument).toContain('Bass');
  });

  it('only enables backend arranging for styles the API can currently honor', () => {
    expect(backendStyleForWebStyle('pop')).toBe('pop');
    expect(backendStyleForWebStyle('jazz')).toBe('jazz');
    expect(backendStyleForWebStyle('modal')).toBeNull();
  });
});
