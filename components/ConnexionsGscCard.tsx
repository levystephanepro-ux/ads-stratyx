'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  connected: boolean
  email: string | null
  connectUrl: string
  token: string
}

export default function ConnexionsGscCard({ connected, email, connectUrl, token }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function disconnect() {
    setLoading(true)
    await fetch('/api/auth/gsc/disconnect', {
      method: 'POST',
      headers: { 'x-app-token': token },
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <div
      className="card"
      style={{
        marginBottom: 12,
        background: 'linear-gradient(150deg, color-mix(in srgb, #4285f4 8%, var(--surface)), var(--surface))',
      }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        {/* Icône GSC */}
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: 'linear-gradient(135deg, #4285f4, #34a853)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Google Search Console</span>
            {connected ? (
              <span className="pill ok" style={{ fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Connecté
              </span>
            ) : (
              <span className="pill" style={{ fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Non connecté
              </span>
            )}
          </div>

          {connected && email && (
            <p className="subtitle" style={{ margin: '0 0 12px', fontSize: 13 }}>
              Compte : <strong>{email}</strong>
            </p>
          )}

          {!connected && (
            <p className="subtitle" style={{ margin: '0 0 14px', fontSize: 13 }}>
              Connecte ton compte Search Console pour voir ta visibilité organique
              et découvrir des opportunités de campagnes Search.
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {connected ? (
              <button
                type="button"
                onClick={disconnect}
                disabled={loading}
                className="btn-ghost"
                style={{ fontSize: 13 }}
              >
                {loading ? 'Déconnexion…' : 'Déconnecter'}
              </button>
            ) : (
              <a href={connectUrl} className="btn" style={{ fontSize: 13 }}>
                Connecter Search Console →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
