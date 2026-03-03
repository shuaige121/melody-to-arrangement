/**
 * MidiPlayer — Standalone MIDI file player component.
 *
 * Features:
 *   - Drag-and-drop or click-to-browse MIDI file loading
 *   - Parses MIDI using @tonejs/midi
 *   - Displays all tracks with name, instrument, note count, channel
 *   - Play / Pause / Stop transport controls + progress bar
 *   - Per-track Mute and Solo buttons
 *   - Drum tracks (channel 9) use MembraneSynth / NoiseSynth
 *   - All other tracks use PolySynth
 *   - Properly handles AudioContext startup (user-gesture gated)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Midi } from '@tonejs/midi';
import * as Tone from 'tone';
import './MidiPlayer.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MidiTrackInfo {
  index: number;
  name: string;
  instrumentName: string;
  instrumentFamily: string;
  channel: number;
  noteCount: number;
  isDrum: boolean;
}

interface TrackPlayState {
  muted: boolean;
  soloed: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRACK_COLORS = [
  'var(--track-color-1)',
  'var(--track-color-2)',
  'var(--track-color-3)',
  'var(--track-color-4)',
  'var(--track-color-5)',
  'var(--track-color-6)',
];

// ---------------------------------------------------------------------------
// Drum kit factory (reuses the pattern from PlaybackEngine)
// ---------------------------------------------------------------------------

interface DrumKit {
  kick: Tone.MembraneSynth;
  snare: Tone.NoiseSynth;
  hihat: Tone.NoiseSynth;
  ride: Tone.NoiseSynth;
}

function createDrumKit(): DrumKit {
  return {
    kick: new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
    }),
    snare: new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
    }),
    hihat: new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
    }),
    ride: new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
    }),
  };
}

function triggerDrumNote(
  kit: DrumKit,
  midiNote: number,
  duration: number,
  time: number,
  velocity: number,
): void {
  switch (midiNote) {
    case 35: case 36:
      kit.kick.triggerAttackRelease('C1', duration, time, velocity);
      break;
    case 37: case 38: case 39: case 40:
      kit.snare.triggerAttackRelease(duration, time, velocity);
      break;
    case 42: case 44:
      kit.hihat.triggerAttackRelease(duration, time, velocity * 0.6);
      break;
    case 46:
      kit.hihat.triggerAttackRelease(duration * 2, time, velocity * 0.7);
      break;
    case 49: case 51: case 52: case 55: case 57: case 59:
      kit.ride.triggerAttackRelease(duration, time, velocity * 0.5);
      break;
    default:
      kit.snare.triggerAttackRelease(duration, time, velocity * 0.4);
      break;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MidiPlayer() {
  // File / parsing state
  const [midi, setMidi] = useState<Midi | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [trackInfos, setTrackInfos] = useState<MidiTrackInfo[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  // Per-track mute/solo
  const [trackStates, setTrackStates] = useState<Record<number, TrackPlayState>>({});

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0-1
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioReady, setAudioReady] = useState(false);

  // Drop zone state
  const [isDragOver, setIsDragOver] = useState(false);

  // Refs for audio resources (mutable, not in React state)
  const synthsRef = useRef<Map<number, Tone.PolySynth>>(new Map());
  const drumKitsRef = useRef<Map<number, DrumKit>>(new Map());
  const volumeNodesRef = useRef<Map<number, Tone.Volume>>(new Map());
  const scheduledIdsRef = useRef<number[]>([]);
  const animFrameRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedMidiRef = useRef<Midi | null>(null);

  // -------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------

  useEffect(() => {
    return () => {
      disposeAudio();
      cancelAnimationFrame(animFrameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------
  // Audio resource management
  // -------------------------------------------------------------------

  function disposeAudio(): void {
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = 0;

    for (const id of scheduledIdsRef.current) {
      transport.clear(id);
    }
    scheduledIdsRef.current = [];

    for (const synth of synthsRef.current.values()) {
      synth.dispose();
    }
    synthsRef.current.clear();

    for (const kit of drumKitsRef.current.values()) {
      kit.kick.dispose();
      kit.snare.dispose();
      kit.hihat.dispose();
      kit.ride.dispose();
    }
    drumKitsRef.current.clear();

    for (const vol of volumeNodesRef.current.values()) {
      vol.dispose();
    }
    volumeNodesRef.current.clear();

    loadedMidiRef.current = null;
  }

  // -------------------------------------------------------------------
  // Solo/mute logic
  // -------------------------------------------------------------------

  const applySoloMuteState = useCallback((states: Record<number, TrackPlayState>) => {
    const anySoloed = Object.values(states).some(s => s.soloed);
    for (const [idxStr, vol] of volumeNodesRef.current.entries()) {
      const idx = Number(idxStr);
      const st = states[idx] || { muted: false, soloed: false };
      if (anySoloed) {
        vol.mute = !st.soloed || st.muted;
      } else {
        vol.mute = st.muted;
      }
    }
  }, []);

  // -------------------------------------------------------------------
  // Load + schedule MIDI
  // -------------------------------------------------------------------

  const loadMidiToTransport = useCallback((midiFile: Midi, states: Record<number, TrackPlayState>) => {
    disposeAudio();

    const transport = Tone.getTransport();
    const tempos = midiFile.header.tempos;
    if (tempos.length > 0) {
      transport.bpm.value = tempos[0].bpm;
    } else {
      transport.bpm.value = 120;
    }

    midiFile.tracks.forEach((track, trackIndex) => {
      if (track.notes.length === 0) return;

      const vol = new Tone.Volume(0).toDestination();
      volumeNodesRef.current.set(trackIndex, vol);

      const isDrum = track.channel === 9;

      if (isDrum) {
        const kit = createDrumKit();
        kit.kick.connect(vol);
        kit.snare.connect(vol);
        kit.hihat.connect(vol);
        kit.ride.connect(vol);
        kit.hihat.volume.value = -12;
        kit.ride.volume.value = -10;
        drumKitsRef.current.set(trackIndex, kit);

        for (const note of track.notes) {
          const dur = Math.max(0.01, note.duration);
          const vel = Math.max(0.01, Math.min(1, note.velocity));
          const id = transport.schedule((time: number) => {
            triggerDrumNote(kit, note.midi, dur, time, vel);
          }, note.time);
          scheduledIdsRef.current.push(id);
        }
      } else {
        const synth = new Tone.PolySynth({
          voice: Tone.Synth,
          maxPolyphony: 16,
          options: {
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.8 },
          },
        });
        synth.connect(vol);
        synthsRef.current.set(trackIndex, synth);

        for (const note of track.notes) {
          const dur = Math.max(0.01, note.duration);
          const vel = Math.max(0.01, Math.min(1, note.velocity));
          const id = transport.schedule((time: number) => {
            synth.triggerAttackRelease(note.name, dur, time, vel);
          }, note.time);
          scheduledIdsRef.current.push(id);
        }
      }
    });

    loadedMidiRef.current = midiFile;

    // Apply current mute/solo state
    applySoloMuteState(states);
  }, [applySoloMuteState]);

  // -------------------------------------------------------------------
  // Parse MIDI file
  // -------------------------------------------------------------------

  const handleMidiFile = useCallback((file: File) => {
    setParseError(null);
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    cancelAnimationFrame(animFrameRef.current);

    const transport = Tone.getTransport();
    transport.stop();
    transport.position = 0;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const parsed = new Midi(arrayBuffer);

        setMidi(parsed);
        setFileName(file.name);
        setDuration(parsed.duration);

        // Build track info array
        const infos: MidiTrackInfo[] = parsed.tracks
          .map((track, index) => ({
            index,
            name: track.name || `Track ${index + 1}`,
            instrumentName: track.instrument.name || 'Unknown',
            instrumentFamily: track.instrument.family || '',
            channel: track.channel,
            noteCount: track.notes.length,
            isDrum: track.channel === 9,
          }))
          .filter(info => info.noteCount > 0);

        setTrackInfos(infos);

        // Initialize track states
        const newStates: Record<number, TrackPlayState> = {};
        infos.forEach(info => {
          newStates[info.index] = { muted: false, soloed: false };
        });
        setTrackStates(newStates);

        // Schedule to transport if audio is ready
        if (audioReady) {
          loadMidiToTransport(parsed, newStates);
        }
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Failed to parse MIDI file');
        setMidi(null);
        setTrackInfos([]);
      }
    };
    reader.onerror = () => {
      setParseError('Failed to read file');
    };
    reader.readAsArrayBuffer(file);
  }, [audioReady, loadMidiToTransport]);

  // -------------------------------------------------------------------
  // AudioContext initialization
  // -------------------------------------------------------------------

  const initAudio = useCallback(async () => {
    try {
      await Tone.start();
      setAudioReady(true);
      // If we already have a parsed MIDI, schedule it now
      if (midi && !loadedMidiRef.current) {
        loadMidiToTransport(midi, trackStates);
      }
    } catch {
      setParseError('Failed to start audio context');
    }
  }, [midi, trackStates, loadMidiToTransport]);

  // -------------------------------------------------------------------
  // Playback animation loop
  // -------------------------------------------------------------------

  useEffect(() => {
    if (!isPlaying || duration <= 0) {
      cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const tick = () => {
      const transport = Tone.getTransport();
      const pos = transport.seconds;
      setCurrentTime(pos);
      setProgress(Math.min(1, pos / duration));

      if (pos >= duration) {
        transport.stop();
        transport.position = 0;
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
        return;
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, duration]);

  // -------------------------------------------------------------------
  // Transport handlers
  // -------------------------------------------------------------------

  const handlePlay = useCallback(async () => {
    if (!midi) return;

    if (!audioReady) {
      await initAudio();
    }

    // Ensure MIDI is loaded into transport
    if (!loadedMidiRef.current && midi) {
      loadMidiToTransport(midi, trackStates);
    }

    const transport = Tone.getTransport();
    if (Tone.getContext().state !== 'running') {
      await Tone.getContext().resume();
    }

    if (isPlaying) {
      transport.pause();
      setIsPlaying(false);
    } else {
      transport.start();
      setIsPlaying(true);
    }
  }, [midi, audioReady, isPlaying, trackStates, initAudio, loadMidiToTransport]);

  const handleStop = useCallback(() => {
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = 0;
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = ratio * duration;

    const transport = Tone.getTransport();
    transport.seconds = newTime;
    setCurrentTime(newTime);
    setProgress(ratio);
  }, [duration]);

  // -------------------------------------------------------------------
  // Per-track mute / solo
  // -------------------------------------------------------------------

  const handleMuteToggle = useCallback((trackIndex: number) => {
    setTrackStates(prev => {
      const st = prev[trackIndex] || { muted: false, soloed: false };
      const next = { ...prev, [trackIndex]: { ...st, muted: !st.muted } };
      applySoloMuteState(next);
      return next;
    });
  }, [applySoloMuteState]);

  const handleSoloToggle = useCallback((trackIndex: number) => {
    setTrackStates(prev => {
      const st = prev[trackIndex] || { muted: false, soloed: false };
      const next = { ...prev, [trackIndex]: { ...st, soloed: !st.soloed } };
      applySoloMuteState(next);
      return next;
    });
  }, [applySoloMuteState]);

  // -------------------------------------------------------------------
  // Drag and drop
  // -------------------------------------------------------------------

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.toLowerCase().endsWith('.mid') || file.name.toLowerCase().endsWith('.midi')) {
        handleMidiFile(file);
      } else {
        setParseError('Please drop a .mid or .midi file');
      }
    }
  }, [handleMidiFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleMidiFile(file);
    }
  }, [handleMidiFile]);

  const handleNewFile = useCallback(() => {
    handleStop();
    disposeAudio();
    setMidi(null);
    setFileName('');
    setTrackInfos([]);
    setTrackStates({});
    setParseError(null);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
  }, [handleStop]);

  // -------------------------------------------------------------------
  // Render: no file loaded — show drop zone
  // -------------------------------------------------------------------

  if (!midi) {
    return (
      <div className="midi-player">
        <div className="midi-player__header">
          <span className="midi-player__title">MIDI Player</span>
        </div>

        {parseError && (
          <div className="midi-player__error">{parseError}</div>
        )}

        {!audioReady && (
          <div className="midi-player__audio-prompt">
            <button className="midi-player__audio-prompt-btn" onClick={initAudio}>
              Click to Enable Audio
            </button>
          </div>
        )}

        <div
          className={`midi-player__dropzone ${isDragOver ? 'midi-player__dropzone--active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="midi-player__dropzone-icon">{'\uD83C\uDFB5'}</span>
          <span className="midi-player__dropzone-text">
            Drop a MIDI file here or click to browse
          </span>
          <span className="midi-player__dropzone-hint">.mid / .midi files supported</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mid,.midi"
            onChange={handleFileInput}
          />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------
  // Render: file loaded — show player
  // -------------------------------------------------------------------

  const tempoDisplay = midi.header.tempos.length > 0
    ? `${Math.round(midi.header.tempos[0].bpm)} BPM`
    : '120 BPM';

  return (
    <div className="midi-player">
      {/* Header */}
      <div className="midi-player__header">
        <span className="midi-player__title">MIDI Player</span>
        <span className="midi-player__file-info">{fileName}</span>
        <button className="midi-player__new-file-btn" onClick={handleNewFile}>
          New File
        </button>
      </div>

      {/* Error */}
      {parseError && (
        <div className="midi-player__error">{parseError}</div>
      )}

      {/* Audio context prompt */}
      {!audioReady && (
        <div className="midi-player__audio-prompt">
          <button className="midi-player__audio-prompt-btn" onClick={initAudio}>
            Click to Enable Audio
          </button>
        </div>
      )}

      {/* Transport */}
      <div className="midi-player__transport">
        <div className="midi-player__transport-btns">
          <button
            className={`midi-player__transport-btn ${
              isPlaying
                ? 'midi-player__transport-btn--pause'
                : 'midi-player__transport-btn--play'
            }`}
            onClick={handlePlay}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '\u23F8' : '\u25B6'}
          </button>
          <button
            className="midi-player__transport-btn"
            onClick={handleStop}
            title="Stop"
          >
            {'\u23F9'}
          </button>
        </div>

        <div className="midi-player__progress-wrap">
          <div className="midi-player__progress-bar" onClick={handleProgressClick}>
            <div
              className="midi-player__progress-fill"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="midi-player__time">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Track list */}
      <div className="midi-player__tracks">
        {trackInfos.map((info) => {
          const st = trackStates[info.index] || { muted: false, soloed: false };
          const color = TRACK_COLORS[info.index % TRACK_COLORS.length];

          return (
            <div className="midi-player__track" key={info.index}>
              <div
                className="midi-player__track-color"
                style={{ backgroundColor: color }}
              />
              <div className="midi-player__track-info">
                <span className="midi-player__track-name">
                  {info.isDrum ? `[Drums] ${info.name}` : info.name}
                </span>
                <span className="midi-player__track-detail">
                  {info.instrumentName}
                  {info.instrumentFamily ? ` (${info.instrumentFamily})` : ''}
                  {' · '}Ch {info.channel}{' · '}{info.noteCount} notes
                </span>
              </div>
              <div className="midi-player__track-controls">
                <button
                  className={`midi-player__track-btn ${st.muted ? 'midi-player__track-btn--mute-active' : ''}`}
                  onClick={() => handleMuteToggle(info.index)}
                  title="Mute"
                >
                  M
                </button>
                <button
                  className={`midi-player__track-btn ${st.soloed ? 'midi-player__track-btn--solo-active' : ''}`}
                  onClick={() => handleSoloToggle(info.index)}
                  title="Solo"
                >
                  S
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer meta */}
      <div className="midi-player__meta">
        <span className="midi-player__meta-badge midi-player__meta-badge--tempo">
          {tempoDisplay}
        </span>
        <span className="midi-player__meta-badge">
          {trackInfos.length} track{trackInfos.length !== 1 ? 's' : ''}
        </span>
        <span className="midi-player__meta-badge">
          {formatTime(duration)} duration
        </span>
        {midi.name && (
          <span className="midi-player__meta-badge">
            {midi.name}
          </span>
        )}
      </div>
    </div>
  );
}
