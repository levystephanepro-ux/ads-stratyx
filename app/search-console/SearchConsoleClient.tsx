'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ScRow, ScSite } from '@/lib/search-console/client'

const PERIODS = [
  { label: '7 jours', days: 7 },
  { label: '28 jours', days: 28 },
  { label: '90 jours', days: 90 },
]

const TABS = [
  { key: 'queries', label: 'Requêtes' },
  { key: 'pages',   label: 'Pages' },
  { key: 'opps',    label: '⚡ Opportunités Ads' },
]

function pct(n: number) { return (n * 100).toFixed(1) + '%' }
function pos(n: number) { return n.toFixed(1) }

function posColor(p: number) {
  if (p <= 3)  return 'var(--green)'
  if (p <= 10) return '#fbbf24'
  return 'var(--red)'
}

function TrendBadge({ position }: { position: number }) {
  const color = posColor(position)
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 99,
      fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
      background: `color-mix(in srgb, ${color} 14%, transparent)`,
      color,
    }}>
      #{pos(position)}
    </span>
  )
}

function MetaRow({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--muted)', opacity: 0.7 }}>{sub}</div>}
    </div>
  )
}

export default function SearchConsoleClient({ token, isMock }: { token: string; isMock: boolean }) {
  const [sites, setSites] = useState<ScSite[]>([])
  const [site, setSite] = useState('')
  const [days, setDays] = useState(28)
  const [tab, setTab] = useState('queries')
  const [rows, setRows] = useState<ScRow[]>([])
  const [loading, setLoading] = useState(false)
  const [sitesLoading, setSitesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Ref stable pour éviter les re-créations à chaque render
  const headersRef = useRef({ 'x-app-token': token })
  const headers = headersRef.current

  // Charger les sites
  useEffect(() => {
    fetch('/api/search-console/sites', { headers })
      .then(async r => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`)
        return d
      })
      .then(d => {
        setSites(d.sites ?? [])
        if (d.sites?.length) setSite(d.sites[0].siteUrl)
      })
      .catch(e => setError(`Sites : ${e.message}`))
      .finally(() => setSitesLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadData = useCallback(async (dim: 'query' | 'page') => {
    if (!site) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ site, days: String(days), dim })
      const r = await fetch(`/api/search-console/data?${params}`, { headers })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setRows(d.rows ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, days])

  useEffect(() => {
    if (!site) return
    const dim = tab === 'pages' ? 'page' : 'query'
    loadData(dim)
  }, [site, days, tab, loadData])

  // Métriques globales
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0)
  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0)
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0
  const avgPos = rows.length > 0
    ? rows.reduce((s, r) => s + r.position * r.impressions, 0) / Math.max(1, totalImpressions)
    : 0

  // Opportunités : requêtes en position 4-20 avec impressions significatives
  const opportunities = rows.filter(r => r.position >= 4 && r.position <= 20 && r.impressions >= 100)
    .sort((a, b) => b.impressions - a.impressions)

  const displayRows = tab === 'opps' ? opportunities : rows

  if (sitesLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '40px 0', color: 'var(--muted)' }}>
        <span className="anim-spin" style={{ width: 18, height: 18, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', display: 'inline-block' }} />
        Chargement des propriétés…
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900 }}>
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 6 }}>
        <div>
          <h1 className="page-title">
            Search <span style={{ color: 'var(--accent-2)' }}>Console</span>
          </h1>
          <p className="page-lede">Visibilité organique · Requêtes · Opportunités Ads</p>
        </div>
      </div>

      {/* Sélecteurs */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {/* Site */}
        <select
          value={site}
          onChange={e => setSite(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 10, border: '1.5px solid var(--border)',
            background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13,
            minWidth: 240, outline: 'none',
          }}
        >
          {sites.map(s => (
            <option key={s.siteUrl} value={s.siteUrl}>
              {s.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </option>
          ))}
          {sites.length === 0 && <option>Aucune propriété</option>}
        </select>

        {/* Période */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', borderRadius: 10, padding: 3, border: '1px solid var(--border)' }}>
          {PERIODS.map(p => (
            <button key={p.days} type="button" onClick={() => setDays(p.days)}
              style={{
                padding: '6px 12px', borderRadius: 8, border: 'none',
                background: days === p.days ? 'var(--surface)' : 'transparent',
                color: days === p.days ? 'var(--text)' : 'var(--muted)',
                fontSize: 12, fontWeight: days === p.days ? 600 : 400,
                boxShadow: days === p.days ? '0 1px 4px rgba(0,0,0,.15)' : 'none',
                cursor: 'pointer', transition: 'all .13s',
              }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isMock && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'color-mix(in srgb, #fbbf24 10%, transparent)', border: '1px solid color-mix(in srgb, #fbbf24 35%, transparent)', fontSize: 12, color: '#fbbf24', marginBottom: 16 }}>
          <span>⚠️</span>
          <span><strong>Mode démonstration</strong> — données fictives. Passe <code style={{ background: 'rgba(0,0,0,.15)', padding: '1px 5px', borderRadius: 4 }}>SEARCH_CONSOLE_DATA_MODE=live</code> dans .env pour connecter ton vrai compte.</span>
        </div>
      )}

      {error && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'color-mix(in srgb, var(--red) 40%, transparent)', color: 'var(--red)', fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Clics', value: totalClicks.toLocaleString('fr-FR'), sub: `${days}j` },
          { label: 'Impressions', value: totalImpressions.toLocaleString('fr-FR'), sub: `${days}j` },
          { label: 'CTR moyen', value: pct(avgCtr), sub: 'taux de clic' },
          { label: 'Position moy.', value: pos(avgPos), sub: 'pondérée' },
        ].map(m => (
          <div key={m.label} className="card" style={{ padding: '16px 20px' }}>
            <MetaRow {...m} />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            style={{
              padding: '8px 16px', border: 'none', background: 'none',
              color: tab === t.key ? 'var(--accent-2)' : 'var(--muted)',
              fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
              borderBottom: `2px solid ${tab === t.key ? 'var(--accent)' : 'transparent'}`,
              cursor: 'pointer', transition: 'all .13s', marginBottom: -1,
            }}>
            {t.label}
            {t.key === 'opps' && opportunities.length > 0 && (
              <span style={{ marginLeft: 6, background: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99 }}>
                {opportunities.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Description onglet opportunités */}
      {tab === 'opps' && (
        <div className="card" style={{ marginBottom: 14, background: 'color-mix(in srgb, var(--accent) 8%, var(--surface))', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', fontSize: 13 }}>
          <strong>Requêtes en position 4–20</strong> avec &gt;100 impressions — tu as de la visibilité organique mais tu n'es pas en top 3.
          Lancer une campagne Search sur ces termes te donnerait une présence immédiate pendant que le SEO progresse.
        </div>
      )}

      {/* Tableau */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 28, color: 'var(--muted)', fontSize: 13 }}>
            <span className="anim-spin" style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', display: 'inline-block' }} />
            Chargement…
          </div>
        ) : displayRows.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            {tab === 'opps' ? 'Aucune opportunité détectée sur cette période.' : 'Aucune donnée.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '11px 16px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    {tab === 'pages' ? 'Page' : 'Requête'}
                  </th>
                  {['Clics', 'Impressions', 'CTR', 'Position'].map(h => (
                    <th key={h} className="num" style={{ padding: '11px 16px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                  ))}
                  {tab === 'opps' && <th style={{ padding: '11px 16px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r, i) => {
                  const label = r.query ?? r.page ?? ''
                  const isPage = tab === 'pages'
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td style={{ padding: '10px 16px', maxWidth: 340 }}>
                        <span style={{
                          fontFamily: isPage ? 'ui-monospace, monospace' : 'inherit',
                          fontSize: isPage ? 12 : 13,
                          color: 'var(--text)',
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }} title={label}>{label}</span>
                      </td>
                      <td className="num" style={{ padding: '10px 16px', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{r.clicks.toLocaleString('fr-FR')}</td>
                      <td className="num" style={{ padding: '10px 16px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{r.impressions.toLocaleString('fr-FR')}</td>
                      <td className="num" style={{ padding: '10px 16px', color: 'var(--muted)' }}>{pct(r.ctr)}</td>
                      <td className="num" style={{ padding: '10px 14px' }}><TrendBadge position={r.position} /></td>
                      {tab === 'opps' && (
                        <td style={{ padding: '10px 14px' }}>
                          <a
                            href={`/copilote?token=${encodeURIComponent(token)}&q=${encodeURIComponent(`Lance une campagne Google Search sur la requête "${label}" — je suis en position ${pos(r.position)} en organique avec ${r.impressions} impressions.`)}`}
                            className="btn-ghost"
                            style={{ fontSize: 11, padding: '5px 10px', display: 'inline-block', whiteSpace: 'nowrap' }}
                          >
                            → Copilote
                          </a>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, opacity: 0.6 }}>
        Données Search Console avec 2–3 jours de délai. {!rows.length && !loading ? '' : `${rows.length} résultat${rows.length > 1 ? 's' : ''}.`}
      </p>
    </div>
  )
}
