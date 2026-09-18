import type { Metadata } from 'next'
import { Archivo, Spline_Sans_Mono } from 'next/font/google'
import './globals.css'

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-archivo',
  display: 'swap',
})

const splineMono = Spline_Sans_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-spline',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'TradeReach AI',
  description: 'Export outreach management for Anwar Group',
}

const themeInit = `try{var t=localStorage.getItem('tr-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${splineMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
