/**
 * Tone.js Playback Engine
 *
 * Provides real-time browser-based playback of arrangements using the
 * Web Audio API via Tone.js. Creates appropriate synthesizers for each
 * track type and schedules note events through the Tone.js Transport.
 *
 * Supports per-track mute/solo/volume control.
 */

import * as Tone from 'tone';
import type { Arrangement, NoteEvent } from '../types/music.ts';
import { midiToNoteName } from './gm-instruments.ts';

/** Transport instance type (not directly exported by Tone.js). */
type ToneTransport = ReturnType<typeof Tone.getTransport>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seconds per bar at the given BPM (assumes 4/4). */
function barSeconds(tempoBpm: number, beatsPerBar = 4): number {
  return (60.0 / Math.max(1e-6, tempoBpm)) * beatsPerBar;
}

/**
 * Infer the track role from its name or channel so we can pick
 * the right synth type.
 */
type TrackRole = 'melody' | 'bass' | 'chords' | 'drums' | 'arp' | 'other';

function inferRole(name: string, channel: number): TrackRole {
  const lower = name.toLowerCase();
  if (lower.includes('drum') || lower.includes('percus') || channel === 9) return 'drums';
  if (lower.includes('bass') || lower.includes('sub')) return 'bass';
  if (lower.includes('lead') || lower.includes('melody') || lower.includes('counter')) return 'melody';
  if (lower.includes('harmony') || lower.includes('pad') || lower.includes('string') || lower.includes('chord')) return 'chords';
  if (lower.includes('arp')) return 'arp';
  return 'other';
}

// ---------------------------------------------------------------------------
// Synth factories
// ---------------------------------------------------------------------------

function createMelodySynth(): Tone.PolySynth {
  return new Tone.PolySynth({
    voice: Tone.Synth,
    maxPolyphony: 8,
    options: {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.6, release: 0.4 },
    },
  });
}

function createBassSynth(): Tone.MonoSynth {
  return new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.3 },
    filter: { type: 'lowpass', frequency: 800, Q: 2 },
    filterEnvelope: {
      attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.3,
      baseFrequency: 200, octaves: 2.5,
    },
  });
}

function createChordSynth(): Tone.PolySynth {
  return new Tone.PolySynth({
    voice: Tone.FMSynth,
    maxPolyphony: 12,
    options: {
      modulationIndex: 2,
      envelope: { attack: 0.08, decay: 0.4, sustain: 0.5, release: 0.6 },
    },
  });
}

function createArpSynth(): Tone.PolySynth {
  return new Tone.PolySynth({
    voice: Tone.Synth,
    maxPolyphony: 8,
    options: {
      oscillator: { type: 'square' },
      envelope: { attack: 0.005, decay: 0.15, sustain: 0.3, release: 0.2 },
    },
  });
}

// ---------------------------------------------------------------------------
// Drum voices
// ---------------------------------------------------------------------------

interface DrumKit {
  kick: Tone.MembraneSynth;
  snare: Tone.NoiseSynth;
  hihat: Tone.NoiseSynth;
  ride: Tone.NoiseSynth;
}

function createDrumKit(): DrumKit {
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.05, octaves: 6,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
  });

  const snare = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
  });

  const hihat = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
  });

  const ride = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
  });

  return { kick, snare, hihat, ride };
}

// ---------------------------------------------------------------------------
// Per-track channel node
// ---------------------------------------------------------------------------

interface TrackChannel {
  volume: Tone.Volume;
}

// ---------------------------------------------------------------------------
// PlaybackEngine
// ---------------------------------------------------------------------------

export class PlaybackEngine {
  private synths: Map<string, Tone.PolySynth | Tone.MonoSynth> = new Map();
  private drumKit: DrumKit | null = null;
  private scheduledIds: number[] = [];
  private initialised = false;
  private _isPlaying = false;
  private totalDuration = 0;
  private loadedArrangement: Arrangement | null = null;

  /** Per-track Volume nodes for mute/volume control. */
  private trackChannels: Map<string, TrackChannel> = new Map();

  /** Track mute/solo/volume state (mirrors UI state for audio control). */
  private muteState: Map<string, boolean> = new Map();
  private soloState: Map<string, boolean> = new Map();
  private volumeState: Map<string, number> = new Map();

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  async init(): Promise<void> {
    if (this.initialised) return;
    await Tone.start();
    this.initialised = true;
  }

  // -----------------------------------------------------------------------
  // Loading
  // -----------------------------------------------------------------------

  loadArrangement(arrangement: Arrangement): void {
    this.stop();
    this.disposeInternals();

    this.loadedArrangement = arrangement;
    this.totalDuration = arrangement.bars * barSeconds(arrangement.tempoBpm);

    const transport = Tone.getTransport();
    transport.bpm.value = arrangement.tempoBpm;
    transport.timeSignature = 4;

    for (const track of arrangement.tracks) {
      const role = inferRole(track.name, track.channel);

      // Create a Volume node for this track
      const vol = new Tone.Volume(0).toDestination();
      const channel: TrackChannel = { volume: vol };
      this.trackChannels.set(track.name, channel);

      // Apply any previously-set volume/mute state
      const savedVol = this.volumeState.get(track.name);
      if (savedVol !== undefined) {
        vol.volume.value = savedVol <= 0 ? -Infinity : 20 * Math.log10(savedVol);
      }
      if (this.muteState.get(track.name)) {
        vol.mute = true;
      }

      if (role === 'drums') {
        this.scheduleDrumTrack(track.notes, transport, vol);
      } else {
        const synth = this.createSynthForRole(role);
        synth.connect(vol);
        this.synths.set(track.name, synth);
        this.scheduleNotes(synth, track.notes, role, transport);
      }
    }

    // Apply solo logic
    this.applySoloState();
  }

  // -----------------------------------------------------------------------
  // Per-track audio control
  // -----------------------------------------------------------------------

  setTrackMute(trackName: string, muted: boolean): void {
    this.muteState.set(trackName, muted);
    const ch = this.trackChannels.get(trackName);
    if (ch) {
      ch.volume.mute = muted;
    }
    // If any solo is active, solo overrides mute display
    this.applySoloState();
  }

  setTrackSolo(trackName: string, soloed: boolean): void {
    this.soloState.set(trackName, soloed);
    this.applySoloState();
  }

  setTrackVolume(trackName: string, volume: number): void {
    this.volumeState.set(trackName, volume);
    const ch = this.trackChannels.get(trackName);
    if (ch) {
      ch.volume.volume.value = volume <= 0 ? -Infinity : 20 * Math.log10(volume);
    }
  }

  private applySoloState(): void {
    const anySoloed = [...this.soloState.values()].some(v => v);
    for (const [name, ch] of this.trackChannels) {
      if (anySoloed) {
        // Only soloed tracks play; muted tracks still muted even if soloed
        const isSoloed = this.soloState.get(name) ?? false;
        const isMuted = this.muteState.get(name) ?? false;
        ch.volume.mute = !isSoloed || isMuted;
      } else {
        ch.volume.mute = this.muteState.get(name) ?? false;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Synth creation
  // -----------------------------------------------------------------------

  private createSynthForRole(role: TrackRole): Tone.PolySynth | Tone.MonoSynth {
    switch (role) {
      case 'melody': return createMelodySynth();
      case 'bass': return createBassSynth();
      case 'chords': return createChordSynth();
      case 'arp': return createArpSynth();
      default: return createMelodySynth();
    }
  }

  // -----------------------------------------------------------------------
  // Scheduling
  // -----------------------------------------------------------------------

  private scheduleNotes(
    synth: Tone.PolySynth | Tone.MonoSynth,
    notes: NoteEvent[],
    role: TrackRole,
    transport: ToneTransport,
  ): void {
    for (const note of notes) {
      const noteName = midiToNoteName(note.pitch);
      const dur = Math.max(0.01, note.duration);
      const vel = Math.max(0.01, Math.min(1, note.velocity / 127));

      if (role === 'bass') {
        const id = transport.schedule((time: number) => {
          (synth as Tone.MonoSynth).triggerAttackRelease(noteName, dur, time, vel);
        }, note.start);
        this.scheduledIds.push(id);
      } else {
        const id = transport.schedule((time: number) => {
          (synth as Tone.PolySynth).triggerAttackRelease(noteName, dur, time, vel);
        }, note.start);
        this.scheduledIds.push(id);
      }
    }
  }

  private scheduleDrumTrack(
    notes: NoteEvent[],
    transport: ToneTransport,
    volumeNode: Tone.Volume,
  ): void {
    if (!this.drumKit) {
      this.drumKit = createDrumKit();
      // Connect all drum voices through the volume node
      this.drumKit.kick.connect(volumeNode);
      this.drumKit.snare.connect(volumeNode);
      this.drumKit.hihat.connect(volumeNode);
      this.drumKit.ride.connect(volumeNode);
      this.drumKit.hihat.volume.value = -12;
      this.drumKit.ride.volume.value = -10;
    }
    const kit = this.drumKit;

    for (const note of notes) {
      const dur = Math.max(0.01, note.duration);
      const vel = Math.max(0.01, Math.min(1, note.velocity / 127));

      const id = transport.schedule((time: number) => {
        switch (note.pitch) {
          case 35: case 36:
            kit.kick.triggerAttackRelease('C1', dur, time, vel);
            break;
          case 37: case 38: case 39: case 40:
            kit.snare.triggerAttackRelease(dur, time, vel);
            break;
          case 42: case 44:
            kit.hihat.triggerAttackRelease(dur, time, vel * 0.6);
            break;
          case 46:
            kit.hihat.triggerAttackRelease(dur * 2, time, vel * 0.7);
            break;
          case 49: case 51: case 52: case 55: case 57: case 59:
            kit.ride.triggerAttackRelease(dur, time, vel * 0.5);
            break;
          default:
            kit.snare.triggerAttackRelease(dur, time, vel * 0.4);
            break;
        }
      }, note.start);
      this.scheduledIds.push(id);
    }
  }

  // -----------------------------------------------------------------------
  // Playback controls
  // -----------------------------------------------------------------------

  play(): void {
    if (!this.initialised) {
      console.warn('PlaybackEngine: audio context not initialised. Call init() first.');
      return;
    }
    const transport = Tone.getTransport();
    if (Tone.getContext().state !== 'running') {
      Tone.getContext().resume();
    }
    transport.start();
    this._isPlaying = true;
  }

  pause(): void {
    const transport = Tone.getTransport();
    transport.pause();
    this._isPlaying = false;
  }

  stop(): void {
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = 0;
    this._isPlaying = false;
  }

  // -----------------------------------------------------------------------
  // Tempo
  // -----------------------------------------------------------------------

  setTempo(bpm: number): void {
    const transport = Tone.getTransport();
    transport.bpm.value = Math.max(20, Math.min(300, bpm));
    if (this.loadedArrangement) {
      this.totalDuration = this.loadedArrangement.bars * barSeconds(bpm);
    }
  }

  // -----------------------------------------------------------------------
  // Position
  // -----------------------------------------------------------------------

  getPosition(): number {
    const transport = Tone.getTransport();
    return transport.seconds;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  getDuration(): number {
    return this.totalDuration;
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  private disposeInternals(): void {
    const transport = Tone.getTransport();

    for (const id of this.scheduledIds) {
      transport.clear(id);
    }
    this.scheduledIds = [];

    for (const synth of this.synths.values()) {
      synth.dispose();
    }
    this.synths.clear();

    if (this.drumKit) {
      this.drumKit.kick.dispose();
      this.drumKit.snare.dispose();
      this.drumKit.hihat.dispose();
      this.drumKit.ride.dispose();
      this.drumKit = null;
    }

    for (const ch of this.trackChannels.values()) {
      ch.volume.dispose();
    }
    this.trackChannels.clear();
  }

  dispose(): void {
    this.stop();
    this.disposeInternals();
    this.loadedArrangement = null;
    this.initialised = false;
  }
}
