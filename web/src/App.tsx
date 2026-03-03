import { useState, useCallback, useRef, useEffect } from 'react';
import type { NoteEvent, Arrangement, KeyEstimate, HarmonyCandidate } from './types/music.ts';
import {
  arrangementToMidi,
  downloadMidi,
  PlaybackEngine,
  parseFile,
  generateArrangementWithAI,
  SUPPORTED_EXTENSIONS,
} from './engine/index.ts';
import { useI18n } from './i18n.ts';
import PianoRoll from './components/PianoRoll.tsx';
import TransportControls from './components/TransportControls.tsx';
import ArrangementView from './components/ArrangementView.tsx';
import TrackList from './components/TrackList.tsx';
import type { TrackState } from './components/TrackList.tsx';
import InstrumentPicker from './components/InstrumentPicker.tsx';
import FileUpload from './components/FileUpload.tsx';
import ReferencePitch from './components/ReferencePitch.tsx';
import UserGuide from './components/UserGuide.tsx';
import LanguageSwitcher from './components/LanguageSwitcher.tsx';
import CreativityLevel from './components/CreativityLevel.tsx';
import './App.css';

type AppScreen = 'welcome' | 'workspace';

function createDemoNotes(tempoBpm: number): NoteEvent[] {
  const secondsPerBeat = 60 / tempoBpm;
  const pitches = [60, 62, 64, 65, 67, 69, 71, 72];
  return pitches.map((pitch, i) => ({
    pitch,
    start: i * secondsPerBeat,
    duration: secondsPerBeat * 0.9,
    velocity: 100,
  }));
}

function App() {
  const { t } = useI18n();

  const [screen, setScreen] = useState<AppScreen>('welcome');
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<string>('vocal');

  const [notes, setNotes] = useState<NoteEvent[]>([]);
  const [arrangement, setArrangement] = useState<Arrangement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [tempo, setTempo] = useState(120);
  const [style, setStyle] = useState<'pop' | 'modal' | 'jazz'>('pop');
  const [complexity, setComplexity] = useState<'basic' | 'rich'>('basic');
  const [creativityLevel, setCreativityLevel] = useState<'conservative' | 'balanced' | 'creative'>('balanced');
  const [bars, setBars] = useState(8);
  const [isGenerating, setIsGenerating] = useState(false);

  const [leadProgram, setLeadProgram] = useState(80);
  const [bassProgram, setBassProgram] = useState(33);
  const [harmonyProgram, setHarmonyProgram] = useState(0);

  const [keyEstimate, setKeyEstimate] = useState<KeyEstimate | null>(null);
  const [harmony, setHarmony] = useState<HarmonyCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInstrumentPanel, setShowInstrumentPanel] = useState(false);

  // New DAW state
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [trackStates, setTrackStates] = useState<Record<string, TrackState>>({});
  const [showPianoRoll, setShowPianoRoll] = useState(true);

  const playbackRef = useRef<PlaybackEngine | null>(null);
  const animFrameRef = useRef<number>(0);
  const loadedArrangementRef = useRef<Arrangement | null>(null);

  const beatsPerBar = 4;

  const getPlaybackEngine = useCallback((): PlaybackEngine => {
    if (!playbackRef.current) playbackRef.current = new PlaybackEngine();
    return playbackRef.current;
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // --- Initialize track states when arrangement changes ---
  useEffect(() => {
    if (arrangement) {
      setTrackStates(prev => {
        const next: Record<string, TrackState> = {};
        for (const track of arrangement.tracks) {
          next[track.name] = prev[track.name] || { muted: false, soloed: false, volume: 0.8 };
        }
        return next;
      });
      if (!selectedTrack && arrangement.tracks.length > 0) {
        setSelectedTrack(arrangement.tracks[0].name);
      }
    }
  }, [arrangement, selectedTrack]);

  // --- Welcome screen handlers ---

  const handleFileSelected = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const result = await parseFile(file, style);
      if (result.notes.length === 0) throw new Error(t('upload.noNotes'));
      setNotes(result.notes);
      setTempo(Math.round(result.tempoBpm));
      setSourceFileName(file.name);
      const estimatedBars = Math.max(4, Math.ceil(
        Math.max(...result.notes.map(n => n.start + n.duration)) / (60 / result.tempoBpm * beatsPerBar)
      ));
      setBars(Math.min(estimatedBars, 32));
      setArrangement(null);
      setKeyEstimate(null);
      setHarmony(null);
      setScreen('workspace');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setIsUploading(false);
    }
  }, [style, beatsPerBar, t]);

  const handleStartManual = useCallback(() => {
    setNotes([]);
    setSourceFileName(null);
    setArrangement(null);
    setKeyEstimate(null);
    setHarmony(null);
    setScreen('workspace');
  }, []);

  const handleLoadDemo = useCallback(() => {
    setNotes(createDemoNotes(120));
    setTempo(120);
    setBars(8);
    setSourceFileName(t('demo.name'));
    setArrangement(null);
    setKeyEstimate(null);
    setHarmony(null);
    setScreen('workspace');
  }, [t]);

  const handleBackToWelcome = useCallback(() => {
    if (playbackRef.current) playbackRef.current.stop();
    setIsPlaying(false);
    setCurrentBeat(0);
    setScreen('welcome');
  }, []);

  // --- Playback ---

  useEffect(() => {
    if (!isPlaying) { cancelAnimationFrame(animFrameRef.current); return; }
    const engine = playbackRef.current;
    if (!engine) return;
    const secondsPerBeat = 60 / tempo;
    const tick = () => {
      const pos = engine.getPosition();
      setCurrentBeat(pos / secondsPerBeat);
      if (pos >= engine.getDuration() && engine.getDuration() > 0) {
        engine.stop();
        setIsPlaying(false);
        setCurrentBeat(0);
        return;
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, tempo]);

  useEffect(() => { return () => { playbackRef.current?.dispose(); }; }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (screen !== 'workspace') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') { e.preventDefault(); handlePlay(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handlePlay = useCallback(async () => {
    try {
      const engine = getPlaybackEngine();
      if (isPlaying) { engine.pause(); setIsPlaying(false); }
      else {
        await engine.init();
        if (arrangement && arrangement !== loadedArrangementRef.current) {
          engine.loadArrangement(arrangement);
          loadedArrangementRef.current = arrangement;
        }
        engine.play();
        setIsPlaying(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.playbackFailed'));
    }
  }, [isPlaying, arrangement, getPlaybackEngine, t]);

  const handleStop = useCallback(() => {
    try {
      if (playbackRef.current) playbackRef.current.stop();
      setIsPlaying(false);
      setCurrentBeat(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.stopFailed'));
    }
  }, [t]);

  // --- Generate (async, with Gemini AI) ---

  const handleGenerate = useCallback(async () => {
    if (notes.length === 0) { setError(t('error.noNotes')); return; }
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateArrangementWithAI(
        notes, tempo, bars, style, complexity, beatsPerBar,
      );

      const arr = result.arrangement;
      // Apply instrument overrides
      for (const track of arr.tracks) {
        if (track.name === 'Lead Melody') track.program = leadProgram;
        else if (track.name === 'Bass') track.program = bassProgram;
        else if (track.name === 'Harmony' || track.name === 'Arp Keys') track.program = harmonyProgram;
      }

      setArrangement(arr);
      setKeyEstimate(result.key);
      setHarmony(result.harmony);
      loadedArrangementRef.current = null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, [notes, tempo, bars, style, complexity, beatsPerBar, leadProgram, bassProgram, harmonyProgram, t]);

  // --- Export ---

  const handleDownloadMidi = useCallback(() => {
    if (!arrangement) { setError(t('error.generateFirst')); return; }
    try {
      const midi = arrangementToMidi(arrangement);
      downloadMidi(midi, `arrangement-${arrangement.style}-${arrangement.bars}bars.mid`);
    } catch (err) { setError(err instanceof Error ? err.message : t('error.midiExport')); }
  }, [arrangement, t]);

  const handleDownloadJson = useCallback(() => {
    if (!arrangement) { setError(t('error.generateFirst')); return; }
    try {
      const data = { arrangement, keyEstimate, harmony, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `arrangement-${arrangement.style}-${arrangement.bars}bars.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) { setError(err instanceof Error ? err.message : t('error.jsonExport')); }
  }, [arrangement, keyEstimate, harmony, t]);

  // --- Track controls ---

  const handleMuteToggle = useCallback((name: string) => {
    setTrackStates(prev => {
      const state = prev[name] || { muted: false, soloed: false, volume: 0.8 };
      const next = { ...prev, [name]: { ...state, muted: !state.muted } };
      if (playbackRef.current) {
        playbackRef.current.setTrackMute(name, !state.muted);
      }
      return next;
    });
  }, []);

  const handleSoloToggle = useCallback((name: string) => {
    setTrackStates(prev => {
      const state = prev[name] || { muted: false, soloed: false, volume: 0.8 };
      const next = { ...prev, [name]: { ...state, soloed: !state.soloed } };
      if (playbackRef.current) {
        playbackRef.current.setTrackSolo(name, !state.soloed);
      }
      return next;
    });
  }, []);

  const handleVolumeChange = useCallback((name: string, volume: number) => {
    setTrackStates(prev => {
      const state = prev[name] || { muted: false, soloed: false, volume: 0.8 };
      return { ...prev, [name]: { ...state, volume } };
    });
    if (playbackRef.current) {
      playbackRef.current.setTrackVolume(name, volume);
    }
  }, []);

  // =========================================================================
  // WELCOME SCREEN
  // =========================================================================

  if (screen === 'welcome') {
    return (
      <div className="welcome-screen">
        <div className="welcome-screen__bg">
          <img src="/images/generated/hero-background.webp" alt="" />
        </div>
        <img src="/images/generated/decorative-musical-notes.webp" alt="" className="welcome-screen__deco welcome-screen__deco--notes" />
        <img src="/images/generated/decorative-monstera.webp" alt="" className="welcome-screen__deco welcome-screen__deco--leaf" />
        <img src="/images/generated/method-music-nature-transparent.webp" alt="" className="welcome-screen__deco welcome-screen__deco--nature" />

        {showGuide && <UserGuide onClose={() => setShowGuide(false)} />}
        <div className="welcome-screen__content">
          <div className="welcome-screen__top-bar">
            <a href="/" className="btn btn--small" style={{ textDecoration: 'none' }}>← zhouruby.com</a>
            <LanguageSwitcher />
            <button className="btn btn--small" onClick={() => setShowGuide(true)}>{t('guide.help')}</button>
          </div>

          <div className="welcome-screen__logo">
            <span className="welcome-screen__logo-icon">
              <img src="/images/logo-transparent.png" alt="Ruby's Music Rainforest" />
            </span>
            <h1 className="welcome-screen__title">{t('welcome.title')}</h1>
          </div>
          <p className="welcome-screen__subtitle">{t('welcome.subtitle')}</p>
          <div className="welcome-screen__question">{t('welcome.question')}</div>

          <FileUpload
            onFileSelected={handleFileSelected}
            isProcessing={isUploading}
            error={uploadError}
            supportedFormats={SUPPORTED_EXTENSIONS}
            sourceType={sourceType}
            onSourceTypeChange={setSourceType}
          />

          <div className="welcome-screen__alt-options">
            <div className="welcome-screen__divider"><span>{t('welcome.or')}</span></div>
            <div className="welcome-screen__buttons">
              <button className="btn btn--outline welcome-screen__btn" onClick={handleStartManual}>
                <span className="welcome-screen__btn-icon">{'\u270F\uFE0F'}</span>
                <div className="welcome-screen__btn-text">
                  <span className="welcome-screen__btn-label">{t('welcome.drawManual')}</span>
                  <span className="welcome-screen__btn-desc">{t('welcome.drawManualDesc')}</span>
                </div>
              </button>
              <button className="btn btn--outline welcome-screen__btn" onClick={handleLoadDemo}>
                <span className="welcome-screen__btn-icon">{'\u{1F3B9}'}</span>
                <div className="welcome-screen__btn-text">
                  <span className="welcome-screen__btn-label">{t('welcome.loadDemo')}</span>
                  <span className="welcome-screen__btn-desc">{t('welcome.loadDemoDesc')}</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // WORKSPACE SCREEN — Logic Pro DAW Layout
  // =========================================================================

  return (
    <div className="daw-container">
      {showGuide && <UserGuide onClose={() => setShowGuide(false)} />}
      {error && (
        <div className="error-banner" onClick={() => setError(null)}>
          <span className="error-banner__message">{error}</span>
          <button className="error-banner__dismiss">&times;</button>
        </div>
      )}

      {/* Top: Transport Bar (merged with ExportPanel) */}
      <TransportControls
        isPlaying={isPlaying} tempo={tempo} style={style} complexity={complexity}
        bars={bars} currentBeat={currentBeat} beatsPerBar={beatsPerBar}
        onPlay={handlePlay} onStop={handleStop}
        onTempoChange={setTempo} onStyleChange={setStyle}
        onComplexityChange={setComplexity} onBarsChange={setBars}
        onGenerate={handleGenerate} onDownloadMidi={handleDownloadMidi}
        onDownloadJson={handleDownloadJson} onShowGuide={() => setShowGuide(true)}
        keyEstimate={keyEstimate} harmony={harmony} isGenerating={isGenerating}
      />
      <div className="daw-reference-strip">
        <ReferencePitch keyEstimate={keyEstimate ? { key: keyEstimate.tonicName, mode: keyEstimate.mode } : null} />
      </div>
      <CreativityLevel level={creativityLevel} onChange={setCreativityLevel} />

      {/* Middle: Track List + Arrangement Timeline */}
      <div className="daw-body">
        {/* Left: Track List */}
        <div className="daw-sidebar">
          <TrackList
            tracks={arrangement?.tracks || []}
            trackStates={trackStates}
            selectedTrack={selectedTrack}
            onTrackSelect={setSelectedTrack}
            onMuteToggle={handleMuteToggle}
            onSoloToggle={handleSoloToggle}
            onVolumeChange={handleVolumeChange}
          />

          {/* Instrument picker (collapsible) */}
          <div className="daw-sidebar__section">
            <div className="daw-sidebar__section-header" onClick={() => setShowInstrumentPanel(!showInstrumentPanel)}>
              <span>{t('sidebar.instruments')}</span>
              <span className="daw-sidebar__toggle-icon">{showInstrumentPanel ? '\u25B2' : '\u25BC'}</span>
            </div>
            {showInstrumentPanel && (
              <div className="daw-sidebar__instruments-body">
                <InstrumentPicker label={t('sidebar.leadMelody')} selectedProgram={leadProgram} onChange={setLeadProgram} />
                <InstrumentPicker label={t('sidebar.bass')} selectedProgram={bassProgram} onChange={setBassProgram} />
                <InstrumentPicker label={t('sidebar.harmonyArp')} selectedProgram={harmonyProgram} onChange={setHarmonyProgram} />
              </div>
            )}
          </div>

          {/* Source info / nav */}
          <div className="daw-sidebar__footer">
            <span className="daw-sidebar__source">
              {sourceFileName ? `${t('sidebar.melody')}: ${sourceFileName}` : t('sidebar.melodyInput')}
            </span>
            <div className="daw-sidebar__footer-btns">
              <button className="btn btn--small btn--demo" onClick={handleLoadDemo}>{t('sidebar.demo')}</button>
              <button className="btn btn--small" onClick={handleBackToWelcome}>{t('sidebar.uploadFile')}</button>
            </div>
          </div>
        </div>

        {/* Center: Arrangement Timeline */}
        <div className="daw-arrange-area">
          {!arrangement && notes.length > 0 && (
            <div className="daw-arrange-area__cta">
              <button className="btn btn--primary btn--large" onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? t('ai.generating') : t('main.generateBtn')}
              </button>
              <span className="daw-arrange-area__cta-hint">
                {notes.length}{t('main.notesLoaded')}
              </span>
            </div>
          )}
          <ArrangementView arrangement={arrangement} currentBeat={currentBeat} />
        </div>
      </div>

      {/* Bottom: Piano Roll (collapsible) */}
      <div className={`daw-piano-roll ${showPianoRoll ? 'daw-piano-roll--open' : 'daw-piano-roll--closed'}`}>
        <div className="daw-piano-roll__header" onClick={() => setShowPianoRoll(!showPianoRoll)}>
          <span>{t('pianoRoll.title')}{selectedTrack ? ` — ${selectedTrack}` : ''}</span>
          <span className="daw-piano-roll__toggle">{showPianoRoll ? '\u25BC' : '\u25B2'}</span>
        </div>
        {showPianoRoll && (
          <PianoRoll notes={notes} onNotesChange={setNotes} bars={bars} beatsPerBar={beatsPerBar} tempoBpm={tempo} />
        )}
      </div>
    </div>
  );
}

export default App;
