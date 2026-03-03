import { useState, useCallback, useRef } from 'react'
import { MidiPreview } from './MidiPreview.tsx'
import './ArrangementComparison.css'

interface PresetMidi {
  key: string
  label: string
  description: string
  url: string
  color: string
}

const BASE = import.meta.env.BASE_URL || '/arranger/'

const PRESETS: PresetMidi[] = [
  {
    key: 'conservative',
    label: 'Conservative',
    description: 'Faithful to the original melody. Minimal embellishment, clean voicing.',
    url: `${BASE}demo/llm_output_conservative.mid`,
    color: 'var(--brand-blue)',
  },
  {
    key: 'balanced',
    label: 'Balanced',
    description: 'Moderate creativity. Tasteful harmonization with natural movement.',
    url: `${BASE}demo/llm_output_balanced.mid`,
    color: 'var(--brand-green)',
  },
  {
    key: 'creative',
    label: 'Creative',
    description: 'Bold reinterpretation. Rich harmonic palette, expressive phrasing.',
    url: `${BASE}demo/llm_output_creative.mid`,
    color: 'var(--brand-pink)',
  },
]

export function ArrangementComparison() {
  const [userMidiUrl, setUserMidiUrl] = useState<string | null>(null)
  const [userFileName, setUserFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Revoke previous object URL
    if (userMidiUrl) {
      URL.revokeObjectURL(userMidiUrl)
    }
    const url = URL.createObjectURL(file)
    setUserMidiUrl(url)
    setUserFileName(file.name)
  }, [userMidiUrl])

  const handleClearFile = useCallback(() => {
    if (userMidiUrl) {
      URL.revokeObjectURL(userMidiUrl)
    }
    setUserMidiUrl(null)
    setUserFileName(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [userMidiUrl])

  return (
    <div className="arrangement-comparison">
      <div className="arrangement-comparison__header">
        <h2 className="arrangement-comparison__heading">
          MIDI Arrangement Comparison
        </h2>
        <p className="arrangement-comparison__subtitle">
          Listen and compare three creativity levels side by side.
          Each arrangement starts from the same melody but applies a different level of AI creativity.
        </p>
      </div>

      {/* Preset comparison grid */}
      <div className="arrangement-comparison__grid">
        {PRESETS.map((preset) => (
          <div
            key={preset.key}
            className="arrangement-comparison__card"
            style={{ '--card-accent': preset.color } as React.CSSProperties}
          >
            <div className="arrangement-comparison__card-badge">
              {preset.label}
            </div>
            <p className="arrangement-comparison__card-desc">{preset.description}</p>
            <MidiPreview
              midiUrl={preset.url}
              id={`viz-${preset.key}`}
            />
          </div>
        ))}
      </div>

      {/* User upload section */}
      <div className="arrangement-comparison__upload-section">
        <h3 className="arrangement-comparison__upload-heading">
          Preview Your Own MIDI
        </h3>
        <p className="arrangement-comparison__upload-desc">
          Upload a .mid file to visualize and play it with the built-in SoundFont synthesizer.
        </p>

        <div className="arrangement-comparison__upload-controls">
          <label className="arrangement-comparison__upload-btn">
            <input
              ref={fileInputRef}
              type="file"
              accept=".mid,.midi"
              onChange={handleFileUpload}
              className="arrangement-comparison__upload-input"
            />
            <span className="btn btn--primary">
              {userFileName ? 'Change File' : 'Choose MIDI File'}
            </span>
          </label>
          {userFileName && (
            <div className="arrangement-comparison__upload-info">
              <span className="arrangement-comparison__upload-filename">{userFileName}</span>
              <button
                className="arrangement-comparison__upload-clear"
                onClick={handleClearFile}
                title="Clear"
              >
                &times;
              </button>
            </div>
          )}
        </div>

        {userMidiUrl && (
          <div className="arrangement-comparison__user-preview">
            <MidiPreview
              midiUrl={userMidiUrl}
              title={userFileName || 'Uploaded MIDI'}
              id="viz-user-upload"
            />
          </div>
        )}
      </div>
    </div>
  )
}
