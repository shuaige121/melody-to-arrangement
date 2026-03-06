import type { NoteEvent } from '../types/music.ts';

const DEFAULT_TEMPO_BPM = 120;
const MIN_AUDIO_DURATION_SECONDS = 0.1;

const FRAME_SIZE = 2048;
const HOP_SIZE = 512;
const RMS_SILENCE_THRESHOLD = 0.01;

const MIN_FREQUENCY_HZ = 50;
const MAX_FREQUENCY_HZ = 2000;

const ONSET_RISE_THRESHOLD = 0.02;
const ONSET_MIN_SEPARATION_SECONDS = 0.12;

type FrameAnalysis = {
  startSample: number;
  endSample: number;
  rms: number;
  pitch: number | null;
};

export async function parseAudioFile(file: File): Promise<{ notes: NoteEvent[]; tempoBpm: number }> {
  const buffer = await file.arrayBuffer();
  const AudioContextConstructor = getAudioContextConstructor();

  if (!AudioContextConstructor) {
    throw new Error('Web Audio API is not supported in this browser.');
  }

  const audioContext = new AudioContextConstructor();

  try {
    const audioBuffer = await audioContext.decodeAudioData(buffer);

    if (audioBuffer.duration < MIN_AUDIO_DURATION_SECONDS) {
      return { notes: [], tempoBpm: DEFAULT_TEMPO_BPM };
    }

    const mono = mixDownToMono(audioBuffer);
    const frames = analyzeFrames(mono, audioBuffer.sampleRate);
    const tempoBpm = estimateTempoBpm(frames, audioBuffer.sampleRate);

    const notes = groupFramesIntoNotes(frames, audioBuffer.sampleRate);
    notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);

    if (notes.length === 0) {
      return { notes: [], tempoBpm };
    }

    return { notes, tempoBpm };
  } finally {
    // Best-effort cleanup; ignore close errors for already-closed/suspended contexts.
    await audioContext.close().catch(() => undefined);
  }
}

function getAudioContextConstructor(): (new () => AudioContext) | null {
  if ('AudioContext' in globalThis) {
    return globalThis.AudioContext;
  }

  const withWebkit = globalThis as typeof globalThis & {
    webkitAudioContext?: new () => AudioContext;
  };
  return withWebkit.webkitAudioContext ?? null;
}

function mixDownToMono(audioBuffer: AudioBuffer): Float32Array {
  const { numberOfChannels, length } = audioBuffer;

  if (numberOfChannels <= 1) {
    return audioBuffer.getChannelData(0).slice();
  }

  const mono = new Float32Array(length);

  for (let channel = 0; channel < numberOfChannels; channel += 1) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      mono[i] += channelData[i];
    }
  }

  const invChannels = 1 / numberOfChannels;
  for (let i = 0; i < length; i += 1) {
    mono[i] *= invChannels;
  }

  return mono;
}

function analyzeFrames(samples: Float32Array, sampleRate: number): FrameAnalysis[] {
  if (samples.length < FRAME_SIZE) {
    return [];
  }

  const frames: FrameAnalysis[] = [];

  for (let start = 0; start + FRAME_SIZE <= samples.length; start += HOP_SIZE) {
    const frame = samples.subarray(start, start + FRAME_SIZE);
    const rms = computeRms(frame);

    let pitch: number | null = null;
    if (rms >= RMS_SILENCE_THRESHOLD) {
      const frequency = detectPitchAutocorrelation(frame, sampleRate);
      if (frequency !== null) {
        const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
        if (midi >= 0 && midi <= 127) {
          pitch = midi;
        }
      }
    }

    frames.push({
      startSample: start,
      endSample: start + FRAME_SIZE,
      rms,
      pitch,
    });
  }

  return frames;
}

function computeRms(frame: Float32Array): number {
  let sumSquares = 0;
  for (let i = 0; i < frame.length; i += 1) {
    sumSquares += frame[i] * frame[i];
  }
  return Math.sqrt(sumSquares / frame.length);
}

function detectPitchAutocorrelation(frame: Float32Array, sampleRate: number): number | null {
  const minLag = Math.max(1, Math.floor(sampleRate / MAX_FREQUENCY_HZ));
  const maxLag = Math.min(frame.length - 2, Math.floor(sampleRate / MIN_FREQUENCY_HZ));

  if (maxLag <= minLag) {
    return null;
  }

  const corr = new Float32Array(maxLag + 1);

  for (let lag = 0; lag <= maxLag; lag += 1) {
    let sum = 0;
    const limit = frame.length - lag;
    for (let i = 0; i < limit; i += 1) {
      sum += frame[i] * frame[i + lag];
    }
    corr[lag] = sum / limit;
  }

  const corrZero = corr[0];
  if (!Number.isFinite(corrZero) || corrZero <= 0) {
    return null;
  }

  let searchStart = minLag;
  for (let lag = minLag + 1; lag <= maxLag; lag += 1) {
    if (corr[lag - 1] > 0 && corr[lag] <= 0) {
      searchStart = lag + 1;
      break;
    }
  }

  if (searchStart >= maxLag - 1) {
    return null;
  }

  let peakLag = -1;
  for (let lag = searchStart + 1; lag < maxLag; lag += 1) {
    if (corr[lag] > corr[lag - 1] && corr[lag] >= corr[lag + 1]) {
      peakLag = lag;
      break;
    }
  }

  if (peakLag === -1) {
    let bestValue = Number.NEGATIVE_INFINITY;
    for (let lag = searchStart; lag <= maxLag; lag += 1) {
      if (corr[lag] > bestValue) {
        bestValue = corr[lag];
        peakLag = lag;
      }
    }
  }

  if (peakLag <= 0) {
    return null;
  }

  if (corr[peakLag] < corrZero * 0.15) {
    return null;
  }

  const frequency = sampleRate / peakLag;
  if (!Number.isFinite(frequency) || frequency < MIN_FREQUENCY_HZ || frequency > MAX_FREQUENCY_HZ) {
    return null;
  }

  return frequency;
}

function groupFramesIntoNotes(frames: FrameAnalysis[], sampleRate: number): NoteEvent[] {
  const notes: NoteEvent[] = [];

  let activePitch: number | null = null;
  let activeStartSample = 0;
  let activeEndSample = 0;
  let rmsTotal = 0;
  let rmsCount = 0;

  const flush = () => {
    if (activePitch === null || rmsCount === 0) {
      return;
    }

    const start = activeStartSample / sampleRate;
    const duration = Math.max(0, (activeEndSample - activeStartSample) / sampleRate);

    if (duration <= 0) {
      return;
    }

    const avgRms = rmsTotal / rmsCount;

    notes.push({
      pitch: activePitch,
      start,
      duration,
      velocity: rmsToVelocity(avgRms),
    });
  };

  for (const frame of frames) {
    const { pitch } = frame;

    if (pitch === null) {
      flush();
      activePitch = null;
      rmsTotal = 0;
      rmsCount = 0;
      continue;
    }

    if (activePitch === null) {
      activePitch = pitch;
      activeStartSample = frame.startSample;
      activeEndSample = frame.endSample;
      rmsTotal = frame.rms;
      rmsCount = 1;
      continue;
    }

    if (pitch === activePitch) {
      activeEndSample = frame.endSample;
      rmsTotal += frame.rms;
      rmsCount += 1;
      continue;
    }

    flush();
    activePitch = pitch;
    activeStartSample = frame.startSample;
    activeEndSample = frame.endSample;
    rmsTotal = frame.rms;
    rmsCount = 1;
  }

  flush();

  return notes;
}

function rmsToVelocity(rms: number): number {
  const minRms = RMS_SILENCE_THRESHOLD;
  const maxRms = 0.5;
  const normalized = clamp((rms - minRms) / (maxRms - minRms), 0, 1);
  return Math.round(1 + normalized * 126);
}

function estimateTempoBpm(frames: FrameAnalysis[], sampleRate: number): number {
  if (frames.length < 2) {
    return DEFAULT_TEMPO_BPM;
  }

  const onsets: number[] = [];
  let lastOnset = Number.NEGATIVE_INFINITY;

  for (let i = 1; i < frames.length; i += 1) {
    const prev = frames[i - 1].rms;
    const curr = frames[i].rms;
    const rise = curr - prev;

    if (curr < RMS_SILENCE_THRESHOLD || rise < ONSET_RISE_THRESHOLD) {
      continue;
    }

    const onsetTime = frames[i].startSample / sampleRate;
    if (onsetTime - lastOnset < ONSET_MIN_SEPARATION_SECONDS) {
      continue;
    }

    onsets.push(onsetTime);
    lastOnset = onsetTime;
  }

  if (onsets.length < 2) {
    return DEFAULT_TEMPO_BPM;
  }

  const intervals: number[] = [];
  for (let i = 1; i < onsets.length; i += 1) {
    const ioi = onsets[i] - onsets[i - 1];
    if (ioi > 0) {
      intervals.push(ioi);
    }
  }

  if (intervals.length === 0) {
    return DEFAULT_TEMPO_BPM;
  }

  const averageIoi = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  if (!Number.isFinite(averageIoi) || averageIoi <= 0) {
    return DEFAULT_TEMPO_BPM;
  }

  let bpm = 60 / averageIoi;

  while (bpm < 40) {
    bpm *= 2;
  }
  while (bpm > 240) {
    bpm /= 2;
  }

  return Math.round(clamp(bpm, 40, 240));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
