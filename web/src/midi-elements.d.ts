// Type declarations for html-midi-player Web Components
// These are loaded via CDN script tag in index.html

import type React from 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'midi-player': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string
        'sound-font'?: string
        visualizer?: string
      }, HTMLElement>
      'midi-visualizer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string
        type?: string
      }, HTMLElement>
    }
  }
}
