import type { KeyEstimate, HarmonyCandidate } from '../types/music.ts';
import { useI18n } from '../i18n.ts';
import LanguageSwitcher from './LanguageSwitcher.tsx';
import './TransportControls.css';

interface TransportControlsProps {
  isPlaying: boolean;
  tempo: number;
  style: 'pop' | 'modal' | 'jazz';
  complexity: 'basic' | 'rich';
  bars: number;
  currentBeat: number;
  beatsPerBar: number;
  onPlay: () => void;
  onStop: () => void;
  onTempoChange: (tempo: number) => void;
  onStyleChange: (style: 'pop' | 'modal' | 'jazz') => void;
  onComplexityChange: (complexity: 'basic' | 'rich') => void;
  onBarsChange: (bars: number) => void;
  // Merged from ExportPanel
  onGenerate: () => void;
  onDownloadMidi: () => void;
  onDownloadJson: () => void;
  onShowGuide: () => void;
  keyEstimate: KeyEstimate | null;
  harmony: HarmonyCandidate | null;
  isGenerating: boolean;
}

function formatPosition(currentBeat: number, beatsPerBar: number): string {
  const bar = Math.floor(currentBeat / beatsPerBar) + 1;
  const beat = Math.floor(currentBeat % beatsPerBar) + 1;
  return `${String(bar).padStart(3, '0')}:${String(beat).padStart(2, '0')}`;
}

export default function TransportControls({
  isPlaying,
  tempo,
  style,
  complexity,
  bars,
  currentBeat,
  beatsPerBar,
  onPlay,
  onStop,
  onTempoChange,
  onStyleChange,
  onComplexityChange,
  onBarsChange,
  onGenerate,
  onDownloadMidi,
  onDownloadJson,
  onShowGuide,
  keyEstimate,
  harmony,
  isGenerating,
}: TransportControlsProps) {
  const { t } = useI18n();

  return (
    <div className="transport-bar">
      {/* Left: Logo + Title */}
      <div className="transport-bar__brand">
        <a href="/" className="transport-bar__home-link" title="Back to zhouruby.com">
          <img src={import.meta.env.BASE_URL + 'logo.png'} alt="Ruby's Music Rainforest" className="transport-bar__logo" />
        </a>
        <span className="transport-bar__title">Arranger</span>
      </div>

      {/* Transport buttons */}
      <div className="transport-bar__buttons">
        <button className="btn btn--icon transport-bar__btn" title={t('transport.rewind')} onClick={onStop}>
          {'\u23EE'}
        </button>
        <button
          className={`btn btn--icon transport-bar__btn ${isPlaying ? 'transport-bar__btn--pause' : 'transport-bar__btn--play'}`}
          title={isPlaying ? t('transport.pause') : t('transport.play')}
          onClick={onPlay}
        >
          {isPlaying ? '\u23F8' : '\u25B6'}
        </button>
        <button className="btn btn--icon transport-bar__btn" title={t('transport.stop')} onClick={onStop}>
          {'\u23F9'}
        </button>
      </div>

      {/* Position */}
      <div className="transport-bar__position">
        <span className="transport-bar__position-value">
          {formatPosition(currentBeat, beatsPerBar)}
        </span>
      </div>

      {/* Parameters */}
      <div className="transport-bar__params">
        <div className="param-group">
          <span className="control-label">BPM</span>
          <input
            type="number"
            className="select-control transport-bar__tempo-input"
            value={tempo}
            min={40}
            max={240}
            onChange={(e) => { const val = Number(e.target.value); if (!isNaN(val) && val >= 40 && val <= 240) onTempoChange(val); }}
          />
        </div>
        <div className="param-group">
          <span className="control-label">{t('transport.bars')}</span>
          <input
            type="number"
            className="select-control transport-bar__bars-input"
            value={bars}
            min={2}
            max={32}
            onChange={(e) => { const val = Number(e.target.value); if (!isNaN(val) && val >= 2 && val <= 32) onBarsChange(val); }}
          />
        </div>
        <div className="param-group">
          <span className="control-label">{t('transport.style')}</span>
          <select className="select-control" value={style} onChange={(e) => onStyleChange(e.target.value as 'pop' | 'modal' | 'jazz')}>
            <option value="pop">{t('transport.stylePop')}</option>
            <option value="modal">{t('transport.styleModal')}</option>
            <option value="jazz">{t('transport.styleJazz')}</option>
          </select>
        </div>
        <div className="param-group">
          <span className="control-label">{t('transport.complexity')}</span>
          <select className="select-control" value={complexity} onChange={(e) => onComplexityChange(e.target.value as 'basic' | 'rich')}>
            <option value="basic">{t('transport.complexityBasic')}</option>
            <option value="rich">{t('transport.complexityRich')}</option>
          </select>
        </div>
      </div>

      {/* Key / Harmony badges */}
      <div className="transport-bar__info">
        {keyEstimate ? (
          <span className="transport-bar__key-badge">
            {keyEstimate.tonicName} {keyEstimate.mode}
          </span>
        ) : (
          <span className="transport-bar__key-badge transport-bar__key-badge--empty">
            {t('export.keyEmpty')}
          </span>
        )}
        {harmony && (
          <span className="transport-bar__harmony-badge" title={harmony.name}>
            {(() => { const syms = harmony.bars.map((c) => c.symbol); const unique = [...new Set(syms)]; return unique.length <= 6 ? syms.join(' | ') : unique.join(' | ') + ' ...'; })()}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="transport-bar__actions">
        <button className="btn btn--primary" onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? t('export.generating') : t('export.generate')}
        </button>
        <button className="btn" onClick={onDownloadMidi}>
          {t('export.downloadMidi')}
        </button>
        <button className="btn" onClick={onDownloadJson}>
          {t('export.downloadJson')}
        </button>
        <button className="btn transport-bar__help-btn" onClick={onShowGuide} title={t('guide.help')}>
          ?
        </button>
        <LanguageSwitcher />
      </div>
    </div>
  );
}
