import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        line: 'var(--line)',
        'line-2': 'var(--line-2)',
        ochre: 'var(--ochre)',
        'ochre-soft': 'var(--ochre-soft)',
        verified: 'var(--verified)',
        'verified-soft': 'var(--verified-soft)',
        unverified: 'var(--unverified)',
        'unverified-soft': 'var(--unverified-soft)',
        ai: 'var(--ai)',
        'ai-soft': 'var(--ai-soft)',
        alert: 'var(--alert)',
        'alert-soft': 'var(--alert-soft)',
        rail: 'var(--rail)',
        'rail-ink': 'var(--rail-ink)',
        'rail-active': 'var(--rail-active)',
      },
      fontFamily: {
        sans: ['var(--font-archivo)', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['var(--font-spline)', 'ui-monospace', 'Menlo', 'monospace'],
      },
      boxShadow: {
        shadow: 'var(--shadow)',
      },
    },
  },
  plugins: [],
}

export default config
