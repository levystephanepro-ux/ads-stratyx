"use client";

// Interface de chat du Copilote. Envoie l'historique à /api/copilote et affiche
// les réponses. Les modifications de campagne passent par une confirmation dans
// le fil de discussion (le modèle demande avant d'agir).
import { useEffect, useRef, useState } from "react";

interface Msg {
  role: "user" | "assistant";
  content: string;
  tools?: string[];
  costUsd?: number;
  totalTokens?: number;
}

const SUGGESTIONS = [
  "Quelles campagnes drainent le budget sans convertir ?",
  "Fais-moi un point sur les 7 derniers jours",
  "Quels mots-clés négatifs je devrais ajouter ?",
];

export default function Copilote({
  token,
  initialQuestion = "",
  accountName,
}: {
  token: string;
  initialQuestion?: string;
  accountName?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState(initialQuestion);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || loading) return;
    setError(null);
    const next: Msg[] = [...messages, { role: "user", content: clean }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/copilote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Erreur ${res.status}`);
      } else {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: data.reply,
            tools: data.toolCalls,
            costUsd: data.costUsd,
            totalTokens: (data.inputTokens ?? 0) + (data.outputTokens ?? 0),
          },
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="card"
      style={{ display: "flex", flexDirection: "column", height: "70vh", padding: 0 }}
    >
      {/* Fil de discussion */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {messages.length === 0 && !loading && (
          <div style={{ margin: "auto", maxWidth: 460, textAlign: "center", paddingTop: 32 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
            <p className="subtitle" style={{ marginTop: 0 }}>
              Pose une question sur tes campagnes. Le copilote interroge ton compte
              en direct.
            </p>
            <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className="btn-ghost"
                  style={{ justifyContent: "flex-start", fontWeight: 400 }}
                  onClick={() => send(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                maxWidth: "80%",
                background: m.role === "user" ? "var(--accent)" : "var(--surface-2)",
                color: m.role === "user" ? "white" : "var(--text)",
                border: m.role === "user" ? "none" : "1px solid var(--border)",
                borderRadius: 12,
                padding: "10px 14px",
              }}
            >
              {m.tools && m.tools.length > 0 && (
                <div className="subtitle" style={{ fontSize: 11, marginBottom: 6, marginTop: 0 }}>
                  🔧 {m.tools.join(" · ")}
                </div>
              )}
              <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.5, fontSize: 14 }}>
                {m.content}
              </div>
              {m.role === "assistant" && m.costUsd !== undefined && (
                <div className="subtitle" style={{ fontSize: 11, marginTop: 6, opacity: 0.6 }}
                  title={`${m.totalTokens?.toLocaleString()} tokens`}>
                  💰 {m.costUsd < 0.0001 ? "<$0.0001" : `$${m.costUsd.toFixed(4)}`}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="subtitle" style={{ fontSize: 13 }}>
            Le copilote réfléchit et interroge Google Ads…
          </div>
        )}

        {error && (
          <div
            className="mono"
            style={{
              color: "var(--red)",
              borderColor: "color-mix(in srgb, var(--red) 45%, transparent)",
            }}
          >
            {error}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Zone de saisie */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Écris ta question…"
          disabled={loading}
          style={{ border: "none", background: "transparent", outline: "none", padding: "2px 0", fontSize: 14 }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {accountName && (
              <span
                className="pill"
                style={{
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 10px",
                }}
              >
                📊 {accountName}
              </span>
            )}
            <span className="subtitle" style={{ fontSize: 12 }}>↵ pour envoyer</span>
          </div>
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            style={{ flexShrink: 0 }}
          >
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
