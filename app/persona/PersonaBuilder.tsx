'use client'

import { useState, useTransition } from 'react'
import { generatePersona, type PersonaFormData, type PersonaGenere } from './actions'

const SECTIONS = [
  { id: 1, label: 'Identité', icon: '👤' },
  { id: 2, label: 'Profil pro', icon: '💼' },
  { id: 3, label: 'Psychographie', icon: '🧠' },
  { id: 4, label: 'Média', icon: '📱' },
  { id: 5, label: 'Stratégie ads', icon: '🎯' },
  { id: 6, label: 'Marque', icon: '🏪' },
]

const INITIAL: Omit<PersonaFormData, 'user_token'> = {
  prenom: '',
  age: '',
  genre: '',
  localisation: '',
  situation_pro: '',
  revenu: '2 500–4 000 €/mois',
  moteurs_achat: [],
  frustrations: '',
  aspirations: '',
  valeur_cardinale: '',
  plateformes: [],
  type_contenu: [],
  rapport_pub: '',
  objectif_campagne: '',
  tunnel: 'Intérêt (MOFU)',
  ton_creatif: [],
  format_pub: '',
  secteur_produit: '',
  proposition_valeur: '',
  a_eviter: '',
}

const REVENU_LABELS = [
  '< 1 500 €/mois', '1 500–2 500 €/mois', '2 500–4 000 €/mois',
  '4 000–6 000 €/mois', '6 000–10 000 €/mois', '> 10 000 €/mois', 'Non renseigné',
]
const TUNNEL_LABELS = ['Découverte (TOFU)', 'Intérêt (MOFU)', 'Décision (BOFU)', 'Fidélité']

export default function PersonaBuilder({ token }: { token: string }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(INITIAL)
  const [result, setResult] = useState<PersonaGenere | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const set = (field: keyof typeof INITIAL, value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const toggle = (field: 'moteurs_achat' | 'plateformes' | 'type_contenu' | 'ton_creatif', val: string) =>
    setForm((f) => {
      const arr = f[field] as string[]
      return { ...f, [field]: arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val] }
    })

  const pill = (field: keyof typeof INITIAL, val: string, multi = false, label?: string) => {
    const arr = Array.isArray(form[field]) ? (form[field] as string[]) : []
    const selected = multi ? arr.includes(val) : form[field] === val
    return (
      <button key={val} type="button"
        onClick={() => multi ? toggle(field as 'moteurs_achat' | 'plateformes' | 'type_contenu' | 'ton_creatif', val) : set(field as keyof typeof INITIAL, val)}
        style={{
          padding: '8px 14px', borderRadius: 'var(--radius)',
          border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
          background: selected ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--surface-2)',
          color: selected ? 'var(--accent-2)' : 'var(--muted)',
          fontSize: 13, cursor: 'pointer', transition: 'all .15s',
          fontWeight: selected ? 500 : 400,
        }}
      >{label || val}</button>
    )
  }

  const textarea = (field: keyof typeof INITIAL, placeholder: string) => (
    <textarea value={form[field] as string} onChange={(e) => set(field, e.target.value)}
      placeholder={placeholder} rows={3}
      style={{ width: '100%', background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: 10, color: 'var(--text)', padding: '10px 12px', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
    />
  )

  const sectionLabel = (text: string) => (
    <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', margin: '24px 0 4px' }}>{text}</p>
  )

  const question = (text: string) => (
    <p style={{ fontSize: 14, color: 'var(--text)', margin: '0 0 10px', fontWeight: 500 }}>{text}</p>
  )

  const pillGroup = (children: React.ReactNode) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>{children}</div>
  )

  const handleSubmit = () => {
    startTransition(async () => {
      setError(null)
      const res = await generatePersona({ ...form, user_token: token })
      if (res.success && res.persona) {
        setResult(res.persona)
      } else {
        setError(res.error || 'Erreur inconnue')
      }
    })
  }

  // ── RESULT VIEW ────────────────────────────────────────────────────────────
  if (result) {
    const score = result.score_pub
    const scoreColor = score >= 70 ? 'var(--green)' : score >= 40 ? '#f59e0b' : 'var(--red)'
    return (
      <div style={{ maxWidth: 720 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>
              Persona <span style={{ color: 'var(--accent-2)' }}>{form.prenom || 'généré'}</span>
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
              {form.secteur_produit} · {form.objectif_campagne}
            </p>
          </div>
          <button onClick={() => { setResult(null); setStep(1); setForm(INITIAL) }}
            style={{ padding: '8px 16px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}>
            + Nouveau persona
          </button>
        </div>

        {/* Score */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 14 }}>
          <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
            <svg viewBox="0 0 36 36" style={{ width: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--surface-2)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke={scoreColor} strokeWidth="3"
                strokeDasharray={`${score} ${100 - score}`} strokeLinecap="round" />
            </svg>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: scoreColor }}>
              {score}
            </span>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{result.score_label}</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>Score d'appétence publicitaire</p>
          </div>
        </div>

        {/* Portrait */}
        <div className="card" style={{ marginBottom: 14 }}>
          <p className="subtitle" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Portrait</p>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>{result.portrait}</p>
        </div>

        {/* Accroche */}
        <div style={{ background: 'color-mix(in srgb, var(--accent) 10%, var(--surface))', border: '1.5px solid color-mix(in srgb, var(--accent) 30%, transparent)', borderRadius: 14, padding: '20px 24px', marginBottom: 14 }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--accent-2)' }}>Accroche idéale</p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text)', fontStyle: 'italic' }}>"{result.accroche}"</p>
        </div>

        {/* Insights */}
        <div style={{ marginBottom: 14 }}>
          <p className="subtitle" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>Insights créatifs</p>
          <div style={{ display: 'grid', gap: 10 }}>
            {result.insights.map((ins, i) => (
              <div key={i} className="card" style={{ display: 'flex', gap: 14 }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                  {i + 1}
                </span>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{ins.titre}</p>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{ins.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mots clés */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div className="card">
            <p className="subtitle" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Mots à utiliser</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {result.mots_cles.utiliser.map((m) => (
                <span key={m} style={{ padding: '4px 10px', borderRadius: 8, background: 'color-mix(in srgb, var(--green) 12%, transparent)', color: 'var(--green)', fontSize: 12, fontWeight: 500 }}>{m}</span>
              ))}
            </div>
          </div>
          <div className="card">
            <p className="subtitle" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Mots à éviter</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {result.mots_cles.eviter.map((m) => (
                <span key={m} style={{ padding: '4px 10px', borderRadius: 8, background: 'color-mix(in srgb, var(--red) 12%, transparent)', color: 'var(--red)', fontSize: 12, fontWeight: 500 }}>{m}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Format + Timing */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          {[
            { label: 'Meilleur moment', value: result.meilleur_moment, icon: '⏰' },
            { label: 'Format idéal', value: result.format_ideal, icon: '📐' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="card">
              <p className="subtitle" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>{icon} {label}</p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Résumé créatif */}
        <div className="card">
          <p className="subtitle" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Résumé créatif</p>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>{result.resume_creatif}</p>
        </div>
      </div>
    )
  }

  // ── FORM VIEW ──────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 className="page-title">Créer un <span style={{ color: 'var(--accent-2)' }}>persona</span></h1>
        <p className="page-lede">Stratyx génère une fiche complète avec insights créatifs et recommandations ads.</p>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 32, overflowX: 'auto', paddingBottom: 4 }}>
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" onClick={() => setStep(s.id)}
            style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 10,
              border: `1.5px solid ${step === s.id ? 'var(--accent)' : 'var(--border)'}`,
              background: step === s.id ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--surface-2)',
              color: step === s.id ? 'var(--accent-2)' : 'var(--muted)',
              fontSize: 12, fontWeight: step === s.id ? 600 : 400, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6 }}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* Card */}
      <div className="card" style={{ padding: '28px 28px 24px' }}>

        {step === 1 && (<>
          {question('Quel prénom fictif donnez-vous à ce persona ?')}
          <input value={form.prenom} onChange={(e) => set('prenom', e.target.value)}
            placeholder="ex : Sophie, Marc, Layla..."
            style={{ width: '100%', background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: 10, color: 'var(--text)', padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 20 }}
          />
          {question('Tranche d\'âge ?')}
          {pillGroup(['18-24', '25-34', '35-44', '45-54', '55+'].map((v) => pill('age', v)))}
          {question('Genre ?')}
          {pillGroup(['Femme', 'Homme', 'Non-binaire', 'Tous genres'].map((v) => pill('genre', v)))}
          {question('Où vit ce persona ?')}
          {pillGroup(['Grande ville', 'Ville moyenne', 'Zone périurbaine', 'Zone rurale', 'International'].map((v) => pill('localisation', v)))}
        </>)}

        {step === 2 && (<>
          {question('Situation professionnelle ?')}
          {pillGroup(['Salarié·e cadre', 'Employé·e', 'Indépendant·e / Freelance', 'Chef·fe d\'entreprise', 'Étudiant·e', 'Retraité·e', 'Sans emploi'].map((v) => pill('situation_pro', v)))}
          {question('Revenu mensuel estimé ?')}
          <div style={{ marginBottom: 20 }}>
            <input type="range" min={0} max={6} step={1}
              value={REVENU_LABELS.indexOf(form.revenu) >= 0 ? REVENU_LABELS.indexOf(form.revenu) : 2}
              onChange={(e) => set('revenu', REVENU_LABELS[+e.target.value])}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
              <span>&lt;1 500€</span><span>1 500</span><span>2 500</span><span>4 000</span><span>6 000</span><span>10 000</span><span>N/A</span>
            </div>
            <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--accent-2)', margin: '8px 0 0' }}>{form.revenu}</p>
          </div>
        </>)}

        {step === 3 && (<>
          {question('Moteurs de décision d\'achat ? (plusieurs choix)')}
          {pillGroup(['Prix / rapport qualité-prix', 'Qualité / durabilité', 'Praticité / gain de temps', 'Marque / prestige', 'Recommandations / avis', 'Impact éthique / RSE', 'Innovation / nouveauté', 'Émotion / coup de cœur'].map((v) => pill('moteurs_achat', v, true)))}
          {question('Frustrations ou douleurs principales ?')}
          {textarea('frustrations', 'ex : manque de temps, prix trop élevés, surcharge d\'info...')}
          {question('Aspiration ou ambition principale ?')}
          {textarea('aspirations', 'ex : gagner du temps, améliorer son style de vie, progresser...')}
          {question('Valeur cardinale ?')}
          {pillGroup(['Liberté', 'Sécurité', 'Appartenance', 'Performance', 'Authenticité', 'Plaisir', 'Impact social'].map((v) => pill('valeur_cardinale', v)))}
        </>)}

        {step === 4 && (<>
          {question('Plateformes principales ? (plusieurs choix)')}
          {pillGroup(['Instagram', 'Facebook', 'TikTok', 'YouTube', 'LinkedIn', 'Google / Search', 'Pinterest', 'X / Twitter'].map((v) => pill('plateformes', v, true)))}
          {question('Types de contenus consommés ? (plusieurs choix)')}
          {pillGroup(['Vidéos courtes (Reels, TikTok)', 'Vidéos longues (YouTube)', 'Articles / presse', 'Stories', 'Podcasts', 'Posts texte / threads', 'Visuels / infographies', 'Lives'].map((v) => pill('type_contenu', v, true)))}
          {question('Rapport aux publicités ?')}
          {pillGroup(['Indifférent·e', 'Méfiant·e / Ad-blocker', 'Curieux·se si pertinent', 'Très réceptif·ve'].map((v) => pill('rapport_pub', v)))}
        </>)}

        {step === 5 && (<>
          {question('Objectif de la campagne ?')}
          {pillGroup(['Notoriété / découverte', 'Considération / engagement', 'Conversion / achat', 'Fidélisation / réactivation', 'Lead generation'].map((v) => pill('objectif_campagne', v)))}
          {question('Stade du tunnel d\'achat ?')}
          <div style={{ marginBottom: 20 }}>
            <input type="range" min={0} max={3} step={1}
              value={TUNNEL_LABELS.indexOf(form.tunnel) >= 0 ? TUNNEL_LABELS.indexOf(form.tunnel) : 1}
              onChange={(e) => set('tunnel', TUNNEL_LABELS[+e.target.value])}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
              {TUNNEL_LABELS.map((l) => <span key={l}>{l.split(' ')[0]}</span>)}
            </div>
            <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--accent-2)', margin: '8px 0 0' }}>{form.tunnel}</p>
          </div>
          {question('Ton créatif ? (plusieurs choix)')}
          {pillGroup(['Humour / décalé', 'Inspirant / aspirationnel', 'Direct / performance', 'Éducatif / pédagogique', 'Émotionnel / storytelling', 'Luxe / premium', 'UGC / authenticité', 'Urgence / scarcité'].map((v) => pill('ton_creatif', v, true)))}
          {question('Format publicitaire idéal ?')}
          {pillGroup(['Vidéo courte (< 15s)', 'Vidéo longue (> 30s)', 'Carrousel', 'Image statique', 'Story verticale', 'Search / texte'].map((v) => pill('format_pub', v)))}
        </>)}

        {step === 6 && (<>
          {question('Secteur ou catégorie de produit ?')}
          {textarea('secteur_produit', 'ex : e-commerce mode, app fintech, SaaS B2B, cosmétiques bio...')}
          {question('Proposition de valeur unique à mettre en avant ?')}
          {textarea('proposition_valeur', 'ex : livraison en 2h, économisez 30%/mois, certifié zéro déchet...')}
          {question('Sujets ou codes à absolument éviter ?')}
          {textarea('a_eviter', 'ex : prix trop visibles, humour potache, anglicismes...')}
        </>)}

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'color-mix(in srgb, var(--red) 10%, transparent)', border: '1.5px solid color-mix(in srgb, var(--red) 30%, transparent)', color: 'var(--red)', fontSize: 13, marginTop: 8 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
          <button type="button" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}
            style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: step === 1 ? 'var(--border)' : 'var(--muted)', fontSize: 14, cursor: step === 1 ? 'default' : 'pointer' }}>
            ← Retour
          </button>

          {step < 6 ? (
            <button type="button" onClick={() => setStep((s) => Math.min(6, s + 1))}
              style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Suivant →
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={isPending}
              style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: isPending ? 'var(--surface-2)' : 'var(--accent)', color: isPending ? 'var(--muted)' : '#fff', fontSize: 14, fontWeight: 600, cursor: isPending ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              {isPending ? (
                <><span className="anim-spin" style={{ width: 14, height: 14, border: '2px solid var(--muted)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} />Génération en cours...</>
              ) : '✨ Générer le persona'}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 16, display: 'flex', gap: 4 }}>
        {SECTIONS.map((s) => (
          <div key={s.id} style={{ flex: 1, height: 3, borderRadius: 99, background: s.id <= step ? 'var(--accent)' : 'var(--border)', transition: 'background .2s' }} />
        ))}
      </div>
    </div>
  )
}
