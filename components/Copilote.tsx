"use client";
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
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {messages.length === 0 && !loading && (
          <div style={{ margin: "auto", maxWidth: 460, textAlign: "center", paddingTop: 32 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
            <p className="subtitle" style={{