'use client'

import { useState, useEffect } from 'react'

export function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const cur = document.documentElement.getAttribute('data-theme')
    const isDark = cur ? cur === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
    setDark(isDark)
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
    try {
      localStorage.setItem('tr-theme', next ? 'dark' : 'light')
    } catch {
      /* private mode */
    }
  }

  return (
    <button className="iconbtn" onClick={toggle} title="Toggle light / dark" aria-label="Toggle theme">
      {dark ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  )
}
