'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { navForRole, crumbFor, ROLE_LABELS } from '@/lib/nav'
import type { SessionUser } from '@/lib/session'
import { signOut } from '@/lib/auth-actions'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const groups = navForRole(user.role)

  return (
    <div className="shell">
      <nav className={`rail ${open ? 'rail-open' : ''}`} aria-label="Primary">
        <div className="brand">
          <Logo size={22} />
          <div>
            <b>TradeReach AI</b>
            <span style={{ fontSize: 10, color: '#7D97A5', display: 'block', letterSpacing: '.06em' }}>
              ANWAR GROUP
            </span>
          </div>
        </div>

        {groups.map((group) => (
          <div className="railgroup" key={group.label}>
            <p>{group.label}</p>
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav ${active ? 'active' : ''}`}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                  {item.hot ? <span className="hot" /> : null}
                  {item.count != null ? <span className="count">{item.count}</span> : null}
                </Link>
              )
            })}
          </div>
        ))}

        <div className="railfoot">
          <div className="who">{user.fullName}</div>
          <div className="whorole">{ROLE_LABELS[user.role]}</div>
          <form action={signOut}>
            <button className="signout" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </nav>

      <main style={{ minWidth: 0 }}>
        <div className="topbar">
          <button
            className="iconbtn railtoggle"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <div className="crumb">{crumbFor(pathname)}</div>
          <div className="grow" />
          <div className="search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input placeholder="Search companies, contacts, markets…" aria-label="Search" />
          </div>
          <ThemeToggle />
          <Link href="/companies" className="btn btn-go btn-sm">
            + Add company
          </Link>
        </div>
        <div className="wrap">{children}</div>
      </main>
    </div>
  )
}
