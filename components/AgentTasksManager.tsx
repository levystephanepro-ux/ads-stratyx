"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AgentTask } from "@/lib/agent/store";

const DAYS = [
  { v: 1, l: "Lundi" },
  { v: 2, l: "Mardi" },
  { v: 3, l: "Mercredi" },
  { v: 4, l: "Jeudi" },
  { v: 5, l: "Vendredi" },
  { v: 6, l: "Samedi" },
  { v: 0, l: "Dimanche" },
];

const MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5 — rapide & économique" },
  { id: "claude-sonnet-5", label: "Sonnet 5 — plus puissant" },
];

function catHue(cat: string): number {
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) & 0xffff;
  return h % 360;
}
function catStyle(cat: string): React.CSSProperties {
  if (!cat) return {};
  return {
    color: `hsl(${catHue(cat)}, 65%, 68%)`,
    borderColor: `hsla(${catHue(cat)}, 60%, 55%, 0.35)`,
    background: `hsla(${catHue(cat)}, 60%, 55%, 0.12)`,
  };
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--text)",
  fontSize: 14,
};

interface Form {
  name: string;
  description: string;
  prompt: string;
  category: string;
  frequency: "daily" | "weekly" | "monthly";
  day_of_week: number;
  day_of_month: number;
  run_hour_utc: number;
  model: string;
  enabled: boolean;
  allow_write: boolean;
}

const EMPTY: Form = {
  name: "",
  description: "",
  prompt: "",
  category: "",
  frequency: "daily",
  day_of_week: 1,
  day_of_month: 1,
  run_hour_utc: 7,
  model: "claude-haiku-4-5-20251001",
  enabled: true,
  allow_write: false,
};

interface RunState {
  loading?: boolean;
  summary?: string;
  emailStatus?: string | null;
  error?: string;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AccountInfo {
  customerId: string;
  name: string;
}

export default function AgentTasksManager({
  tasks,
  token,
  dbReady,
  accounts,
  defaultCustomerId,
  templateCategories = [],
}: {
  tasks: AgentTask[];
  token: string;
  dbReady: boolean;
  accounts: AccountInfo[];
  defaultCustomerId?: string | null;
  templateCategories?: string[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, RunState>>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "scheduled" | "ondemand">("all");
  const [catFilter, setCatFilter] = useState<string>("Tous");
  const [selectedId, setSelectedId] = useState(defaultCustomerId ?? accounts[0]?.customerId ?? "");
  const [accountSaving, setAccountSaving] = useState(false);

  const headers = { "Content-Type": "application/json", "x-app-token": token };

  const selectedAccount = accounts.find((a) => a.customerId === selectedId) ?? accounts[0];

  async function changeAccount(customerId: string) {
    setSelectedId(customerId);
    setAccountSaving(true);
    try {
      await fetch("/api/connexions/default", {
        method: "POST",
        headers,
        body: JSON.stringify({ customer_id: customerId }),
      });
    } finally {
      setAccountSaving(false);
    }
  }

  const allCategories = useMemo(() => {
    const fromAgents = tasks.map((t) => t.category).filter(Boolean) as string[];
    return [...new Set([...templateCategories, ...fromAgents])].sort();
  }, [templateCategories, tasks]);

  // Catégories effectivement présentes dans les agents (pour le filtre)
  const agentCategories = useMemo(() => {
    const cats = tasks.map((t) => t.category).filter(Boolean) as string[];
    return [...new Set(cats)].sort();
  }, [tasks]);

  const scheduledCount = tasks.filter((t) => t.enabled).length;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (filter === "scheduled" && !t.enabled) return false;
      if (filter === "ondemand" && t.enabled) return false;
      if (catFilter !== "Tous" && t.category !== catFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.prompt.toLowerCase().includes(q)
      );
    });
  }, [tasks, query, filter, catFilter]);

  function openNew() {
    setForm(EMPTY);
    setFormError(null);
    setEditingId("new");
  }

  function openEdit(t: AgentTask) {
    setForm({
      name: t.name,
      description: t.description,
      prompt: t.prompt,
      category: t.category ?? "",
      frequency: t.frequency,
      day_of_week: t.day_of_week ?? 1,
      day_of_month: t.day_of_month ?? 1,
      run_hour_utc: t.run_hour_utc ?? 7,
      model: t.model ?? "claude-haiku-4-5-20251001",
      enabled: t.enabled,
      allow_write: t.allow_write,
    });
    setFormError(null);
    setEditingId(t.id);
  }

  async function save() {
    if (!form.name.trim() || !form.prompt.trim()) {
      setFormError("Le nom et le prompt sont obligatoires.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const isNew = editingId === "new";
      const res = await fetch(
        isNew ? "/api/agent/tasks" : `/api/agent/tasks/${editingId}`,
        { method: isNew ? "POST" : "PATCH", headers, body: JSON.stringify(form) },
      );
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? `Erreur ${res.status}`);
      } else {
        setEditingId(null);
        router.refresh();
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: AgentTask) {
    if (!confirm(`Supprimer l'agent « ${t.name} » ?`)) return;
    await fetch(`/api/agent/tasks/${t.id}`, { method: "DELETE", headers });
    router.refresh();
  }

  async function toggle(t: AgentTask) {
    await fetch(`/api/agent/tasks/${t.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ enabled: !t.enabled }),
    });
    router.refresh();
  }

  async function runNow(t: AgentTask) {
    setRuns((r) => ({ ...r, [t.id]: { loading: true } }));
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: t.id, token, customerId: selectedId || undefined }),
      });
      const text = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(text);
      } catch {
        // Réponse non-JSON : timeout Vercel, erreur réseau, etc.
        const preview = text.replace(/<[^>]*>/g, " ").trim().slice(0, 200);
        const hint = res.status === 504 || res.status === 524
          ? "L'agent a dépassé le délai maximum (timeout Vercel)."
          : `Réponse inattendue du serveur (${res.status}).`;
        setRuns((r) => ({ ...r, [t.id]: { error: `${hint}${preview ? ` — ${preview}` : ""}` } }));
        return;
      }
      if (!res.ok) {
        setRuns((r) => ({ ...r, [t.id]: { error: String(data.error ?? `Erreur ${res.status}`) } }));
      } else {
        setRuns((r) => ({
          ...r,
          [t.id]: {
            summary: data.summary as string,
            emailStatus: data.emailStatus as string | null,
            costUsd: data.costUsd as number,
            inputTokens: data.inputTokens as number,
            outputTokens: data.outputTokens as number,
          },
        }));
      }
    } catch (e) {
      setRuns((r) => ({
        ...r,
        [t.id]: { error: e instanceof Error ? e.message : String(e) },
      }));
    }
  }

  return (
    <div>
      {/* Barre d'actions */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <div className="searchbar" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
          <input
            style={inputStyle}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un agent…"
          />
        </div>

        {/* Sélecteur de compte */}
        {accounts.length > 1 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Compte</span>
            <select
              style={{
                ...inputStyle,
                width: "auto",
                padding: "8px 12px",
                fontSize: 13,
                opacity: accountSaving ? 0.6 : 1,
              }}
              value={selectedId}
              onChange={(e) => changeAccount(e.target.value)}
              disabled={accountSaving}
            >
              {accounts.map((a) => (
                <option key={a.customerId} value={a.customerId}>
                  {a.name}
                </option>
              ))}
            </select>
            {accountSaving && <span style={{ fontSize: 12, color: "var(--muted)" }}>…</span>}
          </div>
        ) : selectedAccount ? (
          <span
            className="pill"
            style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px" }}
          >
            📊 {selectedAccount.name}
          </span>
        ) : null}

        <button onClick={openNew} disabled={!dbReady}>
          + Nouvel agent
        </button>
      </div>

      {/* Filtres statut */}
      <div className="chips">
        <button className={`chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
          Tous <span style={{ opacity: 0.6 }}>{tasks.length}</span>
        </button>
        <button className={`chip ${filter === "scheduled" ? "active" : ""}`} onClick={() => setFilter("scheduled")}>
          Programmés <span style={{ opacity: 0.6 }}>{scheduledCount}</span>
        </button>
        <button className={`chip ${filter === "ondemand" ? "active" : ""}`} onClick={() => setFilter("ondemand")}>
          À la demande <span style={{ opacity: 0.6 }}>{tasks.length - scheduledCount}</span>
        </button>
      </div>

      {/* Filtres catégorie */}
      {agentCategories.length > 0 && (
        <div className="chips" style={{ marginTop: -10 }}>
          <button
            className={`chip ${catFilter === "Tous" ? "active" : ""}`}
            onClick={() => setCatFilter("Tous")}
          >
            Toutes catégories
          </button>
          {agentCategories.map((c) => (
            <button
              key={c}
              className={`chip ${catFilter === c ? "active" : ""}`}
              onClick={() => setCatFilter(c)}
              style={catFilter === c ? {} : { color: `hsl(${catHue(c)}, 65%, 68%)`, borderColor: `hsla(${catHue(c)}, 60%, 55%, 0.35)` }}
            >
              <span style={{ fontSize: 10, opacity: catFilter === c ? 0 : 1, marginRight: 2 }}>●</span>
              {c}
              <span style={{ opacity: 0.6 }}>
                {" "}{tasks.filter((t) => t.category === c).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {!dbReady && (
        <div className="card" style={{ marginBottom: 16, borderColor: "color-mix(in srgb, #fbbf24 40%, transparent)" }}>
          <strong>Base de données non branchée.</strong>
          <p className="subtitle" style={{ marginTop: 6, marginBottom: 0 }}>
            Les agents affichés sont ceux par défaut (non modifiables). Ajoute Supabase pour créer et éditer tes propres agents.
          </p>
        </div>
      )}

      {/* Formulaire */}
      {editingId && (
        <div className="card" style={{ marginBottom: 16, background: "var(--surface-2)" }}>
          <h3 style={{ marginTop: 0 }}>
            {editingId === "new" ? "Nouvel agent" : "Modifier l'agent"}
          </h3>
          <div style={{ display: "grid", gap: 12 }}>
            {/* Compte courant (lecture seule) */}
            {selectedAccount && (
              <div>
                <div className="subtitle" style={{ fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Compte Google Ads
                </div>
                <div style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 8, opacity: 0.7, cursor: "default" }}>
                  <span>📊</span>
                  <span>{selectedAccount.name}</span>
                </div>
              </div>
            )}

            {/* Nom + Catégorie */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <label style={{ flex: 1, minWidth: 160 }}>
                <div className="subtitle" style={{ fontSize: 13, marginBottom: 4 }}>Nom</div>
                <input
                  style={inputStyle}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex. Audit quotidien"
                />
              </label>
              <label style={{ width: 200 }}>
                <div className="subtitle" style={{ fontSize: 13, marginBottom: 4 }}>Catégorie</div>
                <input
                  style={inputStyle}
                  list="agent-cat-list"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Choisir ou créer…"
                  autoComplete="off"
                />
                <datalist id="agent-cat-list">
                  {allCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
            </div>

            <label>
              <div className="subtitle" style={{ fontSize: 13, marginBottom: 4 }}>Description courte</div>
              <input
                style={inputStyle}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ce que fait l'agent, en une ligne"
              />
            </label>
            <label>
              <div className="subtitle" style={{ fontSize: 13, marginBottom: 4 }}>
                Consigne (prompt) — ce que l'agent doit faire
              </div>
              <textarea
                style={{ ...inputStyle, minHeight: 120, resize: "vertical", fontFamily: "inherit" }}
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                placeholder="Ex. Analyse mes campagnes des 7 derniers jours et signale les anomalies…"
              />
            </label>

            {/* Modèle */}
            <label>
              <div className="subtitle" style={{ fontSize: 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Modèle IA</div>
              <select
                style={inputStyle}
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>

            {/* Fréquence */}
            <div>
              <div className="subtitle" style={{ fontSize: 12, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Fréquence</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {(["daily", "weekly", "monthly"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={form.frequency === f ? "chip active" : "chip"}
                    style={{ cursor: "pointer" }}
                    onClick={() => setForm({ ...form, frequency: f })}
                  >
                    {f === "daily" ? "Tous les jours" : f === "weekly" ? "Toutes les semaines" : "Tous les mois"}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {form.frequency === "weekly" && (
                  <label>
                    <div className="subtitle" style={{ fontSize: 13, marginBottom: 4 }}>Jour</div>
                    <select
                      style={{ ...inputStyle, width: "auto" }}
                      value={form.day_of_week}
                      onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}
                    >
                      {DAYS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
                    </select>
                  </label>
                )}
                {form.frequency === "monthly" && (
                  <label>
                    <div className="subtitle" style={{ fontSize: 13, marginBottom: 4 }}>Jour du mois</div>
                    <select
                      style={{ ...inputStyle, width: "auto" }}
                      value={form.day_of_month}
                      onChange={(e) => setForm({ ...form, day_of_month: Number(e.target.value) })}
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </label>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 20 }}>
                  <span className="pill" style={{ fontSize: 12 }}>⏰ 07h00 UTC</span>
                  <span className="subtitle" style={{ fontSize: 12 }}>heure fixe (Vercel Hobby)</span>
                </div>
              </div>
            </div>

            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                style={{ width: "auto" }}
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              <span>Programmé (tourne automatiquement + email)</span>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                style={{ width: "auto" }}
                checked={form.allow_write}
                onChange={(e) => setForm({ ...form, allow_write: e.target.checked })}
              />
              <span>
                Autoriser les modifications de campagnes{" "}
                <span className="subtitle" style={{ fontSize: 12 }}>(⚠️ l'agent pourra changer budgets/statuts sans toi)</span>
              </span>
            </label>

            {formError && (
              <div className="mono" style={{ color: "var(--red)" }}>{formError}</div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={save} disabled={saving}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button className="btn-ghost" onClick={() => setEditingId(null)} disabled={saving}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="subtitle" style={{ fontSize: 13, marginBottom: 10 }}>
        {filtered.length} agent{filtered.length > 1 ? "s" : ""}
      </div>

      {/* Liste des agents */}
      <div style={{ display: "grid", gap: 16 }}>
        {filtered.map((t) => {
          const run = runs[t.id];
          return (
            <div className="card" key={t.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  {/* Titre + étiquettes */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>{t.name}</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 1 }}>
                      {t.category && (
                        <span className="pill" style={{ fontSize: 11, padding: "2px 8px", ...catStyle(t.category) }}>
                          {t.category}
                        </span>
                      )}
                      <span className="pill" style={{ fontSize: 11, padding: "2px 8px" }}>
                        {t.model?.includes("sonnet") ? "Sonnet 5" : "Haiku 4.5"}
                      </span>
                    </div>
                  </div>

                  {t.description && (
                    <div className="subtitle" style={{ fontSize: 13, marginTop: 2 }}>{t.description}</div>
                  )}

                  {/* Pills de statut */}
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {t.enabled ? (
                      <>
                        <span className="pill">
                          {t.frequency === "daily"
                            ? "Quotidien"
                            : t.frequency === "monthly"
                            ? `Le ${t.day_of_month ?? 1} du mois`
                            : `Chaque ${DAYS.find((d) => d.v === (t.day_of_week ?? 1))?.l.toLowerCase()}`}
                        </span>
                        <span className="pill ok">Programmé</span>
                      </>
                    ) : (
                      <span className="pill">À la demande</span>
                    )}
                    {t.allow_write && <span className="pill warn">Peut modifier</span>}
                    {t.last_status && (
                      <span className="pill" title={t.last_run_at ?? ""}>
                        Dernier : {t.last_status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={() => runNow(t)} disabled={run?.loading}>
                    {run?.loading ? "…" : "Lancer"}
                  </button>
                  {dbReady && (
                    <>
                      <button className="btn-ghost" onClick={() => toggle(t)}>
                        {t.enabled ? "Suspendre" : "Activer"}
                      </button>
                      <button className="btn-ghost" onClick={() => openEdit(t)}>
                        Modifier
                      </button>
                      <button className="btn-ghost" style={{ color: "var(--red)" }} onClick={() => remove(t)}>
                        Suppr.
                      </button>
                    </>
                  )}
                </div>
              </div>

              {run?.loading && (
                <p className="subtitle" style={{ fontSize: 13, marginTop: 12, marginBottom: 0 }}>
                  L'agent interroge Google Ads et analyse…
                </p>
              )}
              {run?.error && (
                <div className="mono" style={{ marginTop: 12, color: "var(--red)" }}>{run.error}</div>
              )}
              {run?.summary && (
                <div className="card" style={{ marginTop: 12, background: "var(--surface-2)" }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    {run.emailStatus && (
                      <span className={`pill ${run.emailStatus === "envoyé" ? "ok" : "warn"}`}>
                        Email : {run.emailStatus}
                      </span>
                    )}
                    Offre limitée — Du <strong>28/04/2026</strong> au <strong>13/06/2026</strong><br>
                      <span className="pill" title={`${run.inputTokens} in · ${run.outputTokens} out`}>
                        💰 {run.costUsd < 0.0001 ? "<$0.0001" : `$${run.costUsd.toFixed(4)}`}
                      </span>
                    )}
                    {run.inputTokens !== undefined && (
                      <span className="pill" style={{ opacity: 0.7, fontSize: 11 }}>
                        {((run.inputTokens ?? 0) + (run.outputTokens ?? 0)).toLocaleString()} tokens
                      </span>
                    )}
                  </div>
                  <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, fontFamily: "inherit", fontSize: 14, lineHeight: 1.55 }}>
                    {run.summary}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="card">
          <p className="subtitle" style={{ margin: 0 }}>
            Aucun agent ne correspond à ce filtre ou cette recherche.
          </p>
        </div>
      )}
    </div>
  );
}
