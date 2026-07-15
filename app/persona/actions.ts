// app/persona/actions.ts
'use server'

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export type PersonaFormData = {
  prenom: string
  age: string
  genre: string
  localisation: string
  situation_pro: string
  revenu: string
  moteurs_achat: string[]
  frustrations: string
  aspirations: string
  valeur_cardinale: string
  plateformes: string[]
  type_contenu: string[]
  rapport_pub: string
  objectif_campagne: string
  tunnel: string
  ton_creatif: string[]
  format_pub: string
  secteur_produit: string
  proposition_valeur: string
  a_eviter: string
  user_token: string
}

export type PersonaGenere = {
  portrait: string
  insights: { titre: string; detail: string }[]
  accroche: string
  mots_cles: { utiliser: string[]; eviter: string[] }
  meilleur_moment: string
  format_ideal: string
  score_pub: number
  score_label: string
  resume_creatif: string
}

export async function generatePersona(data: PersonaFormData): Promise<{
  success: boolean
  persona?: PersonaGenere
  id?: string
  error?: string
}> {
  const prompt = buildPrompt(data)

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')

    const jsonMatch = rawText.match(/```json\n?([\s\S]*?)\n?```/) || rawText.match(/(\{[\s\S]*\})/)
    if (!jsonMatch) throw new Error('Pas de JSON dans la réponse Anthropic')

    const persona_genere: PersonaGenere = JSON.parse(jsonMatch[1])

    const { data: inserted, error } = await supabase
      .from('personas')
      .insert({
        user_token: data.user_token,
        prenom: data.prenom,
        age: data.age,
        genre: data.genre,
        localisation: data.localisation,
        situation_pro: data.situation_pro,
        revenu: data.revenu,
        moteurs_achat: data.moteurs_achat,
        frustrations: data.frustrations,
        aspirations: data.aspirations,
        valeur_cardinale: data.valeur_cardinale,
        plateformes: data.plateformes,
        type_contenu: data.type_contenu,
        rapport_pub: data.rapport_pub,
        objectif_campagne: data.objectif_campagne,
        tunnel: data.tunnel,
        ton_creatif: data.ton_creatif,
        format_pub: data.format_pub,
        secteur_produit: data.secteur_produit,
        proposition_valeur: data.proposition_valeur,
        a_eviter: data.a_eviter,
        persona_genere,
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)

    return { success: true, persona: persona_genere, id: inserted.id }
  } catch (err) {
    console.error('[generatePersona]', err)
    return { success: false, error: String(err) }
  }
}

export async function getPersonas(user_token: string) {
  const { data, error } = await supabase
    .from('personas')
    .select('id, prenom, age, secteur_produit, objectif_campagne, persona_genere, created_at')
    .eq('user_token', user_token)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return []
  return data
}

export async function getPersonaById(id: string) {
  const { data, error } = await supabase
    .from('personas')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data
}

function buildPrompt(d: PersonaFormData): string {
  return `Tu es un expert en stratégie créative publicitaire. À partir des données suivantes sur un persona cible, génère une fiche persona complète et actionnables pour optimiser des campagnes publicitaires.

DONNÉES DU PERSONA :
- Prénom fictif : ${d.prenom || 'Non défini'}
- Âge : ${d.age}
- Genre : ${d.genre}
- Localisation : ${d.localisation}
- Situation professionnelle : ${d.situation_pro}
- Revenu mensuel : ${d.revenu}
- Moteurs d'achat : ${d.moteurs_achat.join(', ')}
- Frustrations : ${d.frustrations}
- Aspirations : ${d.aspirations}
- Valeur cardinale : ${d.valeur_cardinale}
- Plateformes actives : ${d.plateformes.join(', ')}
- Types de contenus consommés : ${d.type_contenu.join(', ')}
- Rapport aux publicités : ${d.rapport_pub}
- Objectif campagne : ${d.objectif_campagne}
- Stade du tunnel : ${d.tunnel}
- Ton créatif préféré : ${d.ton_creatif.join(', ')}
- Format publicitaire idéal : ${d.format_pub}
- Secteur / Produit : ${d.secteur_produit}
- Proposition de valeur : ${d.proposition_valeur}
- À éviter : ${d.a_eviter}

Génère une réponse UNIQUEMENT en JSON valide (pas de texte avant ou après), avec cette structure exacte :

\`\`\`json
{
  "portrait": "Portrait narratif vivant de 120-150 mots qui décrit qui est cette personne, sa vie quotidienne, ses habitudes, ce qui la motive et ce qui la freine. Écrit à la 3e personne, ton humain et précis.",
  "insights": [
    {
      "titre": "Insight créatif court (5 mots max)",
      "detail": "Explication actionnable de 30-40 mots sur comment exploiter cet insight dans les créas"
    },
    {
      "titre": "Deuxième insight",
      "detail": "Explication actionnable"
    },
    {
      "titre": "Troisième insight",
      "detail": "Explication actionnable"
    }
  ],
  "accroche": "La phrase d'accroche idéale pour cette personne — percutante, dans son langage, max 12 mots",
  "mots_cles": {
    "utiliser": ["mot1", "mot2", "mot3", "mot4", "mot5"],
    "eviter": ["mot1", "mot2", "mot3"]
  },
  "meilleur_moment": "Moment et contexte idéal pour toucher ce persona (ex: mardi matin sur mobile, pendant sa pause déjeuner)",
  "format_ideal": "Format et durée recommandés avec justification courte (30 mots max)",
  "score_pub": 72,
  "score_label": "Réceptif sous conditions",
  "resume_creatif": "Résumé créatif de 50 mots : comment parler à cette personne, quoi lui promettre, et comment l'engager vers la conversion"
}
\`\`\`

Le score_pub va de 0 (imperméable aux pubs) à 100 (très réceptif). Adapte score_label au score.`
}
