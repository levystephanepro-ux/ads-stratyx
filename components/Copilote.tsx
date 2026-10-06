"use client";
// Copilote (lecture seule, façon Ades) : bibliothèque de prompts, exemples,
// historique des conversations (stocké dans le navigateur) et contexte du compte
// (« Enrichir l'agent ») envoyé à l'IA à chaque question.
import { useEffect, useRef, useState } from "react";

interface Msg {
  role: "user" | "assistant";
  content: string;
  tools?: string[];
  costUsd?: number;
}
interface Conversation {
  id: string;
  title: string;
  date: string;
  messages: Msg[];
}

const PROMPTS: { icon: string; title: string; prompt: string }[] = [
  { icon: "🩺", title: "Bilan de santé du compte", prompt: "Fais un bilan complet du compte : (1) structure des campagnes, logique et évolutive ? (2) stratégies d'enchères adaptées au volume de conversions ? (3) suivi des conversions fiable ? (4) budget bien réparti ? (5) principal gaspillage. Termine par 5 priorités classées par impact." },
  { icon: "🚫", title: "Trafic hors sujet", prompt: "Passe en revue les recherches des 30 derniers jours et repère celles qui n'ont rien à voir avec ce que vend l'entreprise (voir le contexte du compte) : emploi, gratuit, tutoriel, autre métier, autre zone. Propose les négatifs à ajouter, avec la correspondance, la campagne et la dépense concernée." },
  { icon: "🔑", title: "Mots-clés à tirer des recherches", prompt: "Récupère les 100 recherches qui ont le plus dépensé sur 30 jours. Liste : (1) celles qui convertissent bien et ne sont pas encore des mots-clés, à ajouter en exact ; (2) celles qui dépensent sans convertir et sont hors sujet, à exclure ; (3) les thèmes récurrents qui mériteraient leur propre groupe d'annonces." },
  { icon: "✍️", title: "Annonces tirées des recherches qui convertissent", prompt: "Relève les annonces responsives des groupes qui dépensent le plus sur 30 jours et leurs éléments notés « Faible » ou peu servis. Pour chaque groupe, propose 3 titres (30 caractères au plus) et 1 description (90 au plus) de remplacement, tirés des recherches qui convertissent, et dis lesquels remplacer." },
  { icon: "📉", title: "Relancer les annonces qui faiblissent", prompt: "Pour les groupes d'annonces qui dépensent le plus sur 30 jours, compare leurs annonces : CTR, taux de conversion, coût par conversion, force de l'annonce. Dis lesquelles garder, lesquelles mettre en pause, et ce qui manque (titres, descriptions, extensions)." },
  { icon: "🎯", title: "Rythme du budget mensuel", prompt: "Le compte va-t-il tenir son budget du mois ? Calcule la dépense du 1er à hier, projette la fin du mois au rythme actuel, compare au budget mensuel visé (contexte du compte, sinon budgets journaliers × 30,4) et dis quelles campagnes ralentir ou accélérer, chiffres à l'appui." },
  { icon: "📊", title: "Bilan des campagnes", prompt: "Fais le bilan de chaque campagne sur 90 jours : dépense, conversions, CPA ou ROAS, évolution par rapport aux 90 jours précédents. Dis ce qui marche et pourquoi, ce qui coince et pourquoi, puis les 3 actions à mener en premier." },
  { icon: "🔍", title: "Audit des annonces", prompt: "Audite les annonces actives : force de l'annonce, titres et descriptions faibles, fautes ou majuscules, extensions manquantes (liens annexes, accroches, appel). Classe les corrections par impact." },
];

const EXAMPLES = [
  "Quelles campagnes ont le plus dépensé cette semaine, pour combien de conversions ?",
  "Quels termes de recherche m'ont coûté le plus sans convertir en 30 j ?",
  "Compare mes conversions des 7 derniers jours aux 7 précédents.",
  "Quels mots-clés ont un Quality Score sous 5 et dépensent ?",
  "Qu'est-ce qui a changé sur le compte ces 14 derniers jours ?",
  "Quelle campagne mérite plus de budget ?",
];

const store = {
  load(key: string): Conversation[] {
    try { return JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { return []; }
  },
  save(key: string, list: Conversation[]) {
    try { localStorage.setItem(key, JSON.stringify(list.slice(0, 30))); } catch { /* stockage indisponible */ }
  },
};

export default function Copilote({
  token,
  initialQuestion = "",
  accountName,
  customerId,
}: {
  token: string;
  initialQuestion?: string;
  accountName?: string;
  customerId?: string;
}) {
  const storeKey = `stratyx-copilote-${customerId ?? "defaut"}`;
  const [history, setHistory] = useState<Conversation[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState(initialQuestion);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExamples, setShowExamples] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [context, setContext] = useState("");
  const [contextState, setContextState] = useState<"" | "saving" | "saved">("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHistory(store.load(storeKey)); }, [storeKey]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => {
    fetch(`/api/copilote/context?token=${encodeURIComponent(token)}&customerId=${encodeURIComponent(customerId ?? "")}`)
      .then((r) => r.json()).then((d) => setContext(d.context ?? "")).catch(() => {});
  }, [token, customerId]);

  function persist(id: string, msgs: Msg[]) {
    const title = msgs.find((m) => m.role === "user")?.content.slice(0, 60) ?? "Conversation";
    const date = new Date().toLocaleDateString("fr-FR");
    const list = [{ id, title, date, messages: msgs }, ...history.filter((c) => c.id !== id)];
    setHistory(list);
    store.save(storeKey, list);
  }

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || loading) return;
    setError(null);
    const id = current ?? String(Date.now());
    if (!current) setCurrent(id);
    const next: Msg[] = [...messages, { role: "user", content: clean }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/copilote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Erreur ${res.status}`);
        persist(id, next);
      } else {
        const done = [...next, { role: "assistant" as const, content: data.reply, tools: data.toolCalls, costUsd: data.costUsd }];
        setMessages(done);
        persist(id, done);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function newConversation() {
    setCurrent(null); setMessages([]); setError(null); setInput("");
  }

  async function saveContext() {
    setContextState("saving");
    await fetch("/api/copilote/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, customerId, context }),
    }).catch(() => {});
    setContextState("saved");
    setTimeout(() => setContextState(""), 2000);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 240px) minmax(0, 1fr)", gap: 16, alignItems: "start" }} className="copilote-layout">
      {/* Colonne gauche : conversations */}
      <aside>
        <button className="btn-ghost" style={{ width: "100%", marginBottom: 12 }} onClick={newConversation}>+ Nouvelle conversation</button>
        {history.length > 0 && <div className="subtitle" style={{ fontSize: 11, textTransform: "uppercase", margin: "0 0 6px" }}>Conversations</div>}
        <div style={{ display: "grid", gap: 4 }}>
          {history.map((c) => (
            <button key={c.id} onClick={() => { setCurrent(c.id); setMessages(c.messages); setError(null); }}
              style={{ textAlign: "left", background: c.id === current ? "var(--surface-2)" : "transparent", border: "none", borderRadius: 8, padding: "8px 10px", color: "var(--text)", cursor: "pointer" }}>
              <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</div>
              <div className="subtitle" style={{ fontSize: 11, margin: 0 }}>{c.date} · {c.messages.filter((m) => m.role === "user").length} question(s)</div>
            </button>
          ))}
        </div>
      </aside>

      {/* Colonne droite : chat */}
      <div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button className="btn-ghost" onClick={() => setShowContext((v) => !v)}>Enrichir l&apos;agent</button>
        </div>

        {showContext && (
          <div className="card" style={{ marginBottom: 12 }}>
            <strong>Contexte du compte{accountName ? ` · ${accountName}` : ""}</strong>
            <p className="subtitle" style={{ margin: "4px 0 8px", fontSize: 13 }}>
              Ce que vend l&apos;entreprise, sa zone d&apos;intervention, ses concurrents, son CPA cible, son budget mensuel. L&apos;IA s&apos;en sert à chaque réponse.
            </p>
            <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={6}
              placeholder="Ex. : Menuiserie premium (fenêtres, volets, vérandas, pergolas) à La Farlède. Zone : Toulon et 30 km autour. Pas de dépannage ni de vente de pièces. CPA cible 150 €. Budget 930 €/mois."
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontFamily: "inherit", fontSize: 14 }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
              <button onClick={saveContext} disabled={contextState === "saving"}>Enregistrer</button>
              {contextState === "saved" && <span className="subtitle" style={{ fontSize: 13, margin: 0 }}>Enregistré.</span>}
            </div>
          </div>
        )}

        {messages.length === 0 && !loading ? (
          <div>
            <div className="subtitle" style={{ fontSize: 13, margin: "0 0 8px" }}>Bibliothèque de prompts</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10, marginBottom: 16 }}>
              {PROMPTS.map((p) => (
                <button key={p.title} onClick={() => send(p.prompt)} className="card interactive"
                  style={{ textAlign: "left", display: "flex", gap: 10, alignItems: "center", padding: "12px 14px", cursor: "pointer", color: "var(--text)", font: "inherit" }}>
                  <span style={{ fontSize: 18 }}>{p.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{p.title}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="card" style={{ maxHeight: "60vh", overflowY: "auto", marginBottom: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 14 }}>
                <div style={{ maxWidth: "85%", background: m.role === "user" ? "var(--accent)" : "var(--surface-2)", color: m.role === "user" ? "white" : "var(--text)",
                  border: m.role === "user" ? "none" : "1px solid var(--border)", borderRadius: 12, padding: "10px 14px" }}>
                  {m.tools && m.tools.length > 0 && (
                    <div className="subtitle" style={{ fontSize: 11, marginBottom: 6, marginTop: 0 }}>Consulté : {m.tools.join(" · ")}</div>
                  )}
                  <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.5, fontSize: 14 }}>{m.content}</div>
                  {m.role === "assistant" && m.costUsd !== undefined && (
                    <div className="subtitle" style={{ fontSize: 11, marginTop: 6, opacity: 0.6 }}>{Math.max(1, Math.round(m.costUsd / 0.05))} crédit(s)</div>
                  )}
                </div>
              </div>
            ))}
            {loading && <div className="subtitle" style={{ fontSize: 13 }}>Le copilote interroge le compte…</div>}
            {error && <div className="mono" style={{ color: "var(--red)" }}>{error}</div>}
            <div ref={endRef} />
          </div>
        )}

        <div className="card" style={{ padding: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder="Pose ta question sur ce compte…" disabled={loading}
              style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 14 }} />
            <button onClick={() => send(input)} disabled={loading || !input.trim()}>Demander</button>
          </div>
          <button onClick={() => setShowExamples((v) => !v)} className="subtitle"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, margin: "8px 0 0", padding: 0 }}>
            {showExamples ? "▾" : "▸"} Exemples de questions
          </button>
          {showExamples && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {EXAMPLES.map((q) => (
                <button key={q} className="pill" onClick={() => send(q)} style={{ cursor: "pointer", fontSize: 12 }}>{q}</button>
              ))}
            </div>
          )}
          <div className="subtitle" style={{ fontSize: 11, margin: "8px 0 0" }}>
            Lecture seule : le copilote lit ton compte en direct et propose, il ne modifie rien.{accountName ? ` · ${accountName}` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
