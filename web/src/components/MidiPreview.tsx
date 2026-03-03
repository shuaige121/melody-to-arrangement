import { useEffect, useRef } from 'react'
import './MidiPreview.css'

// Types for midi-player/midi-visualizer are declared in src/midi-elements.d.ts

interface MidiPreviewProps {
  midiUrl: string
  title?: string
  id?: string
}

export function MidiPreview({ midiUrl, title, id }: MidiPreviewProps) {
  const playerRef = useRef<HTMLElement>(null)
  const vizRef = useRef<HTMLElement>(null)

  useEffect(() => {
    // Link player to visualizer after elements mount
    const timer = setTimeout(() => {
      if (playerRef.current && vizRef.current) {
        try {
          (playerRef.current as any).addVisualizer?.(vizRef.current)
        } catch {
          // html-midi-player may not be loaded yet
        }
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [midiUrl])

  // Update src dynamically when midiUrl changes
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.setAttribute('src', midiUrl)
    }
    if (vizRef.current) {
      vizRef.current.setAttribute('src', midiUrl)
    }
  }, [midiUrl])

  const vizId = id || `viz-${(title || 'default').replace(/\s+/g, '-').toLowerCase()}`

  return (
    <div className="midi-preview">
      {title && <h3 className="midi-preview__title">{title}</h3>}
      <div className="midi-preview__visualizer-wrap">
        <midi-visualizer
          ref={vizRef}
          id={vizId}
          src={midiUrl}
          type="piano-roll"
        />
      </div>
      <div className="midi-preview__player-wrap">
        <midi-player
          ref={playerRef}
          src={midiUrl}
          sound-font=""
          visualizer={`#${vizId}`}
        />
      </div>
    </div>
  )
}
