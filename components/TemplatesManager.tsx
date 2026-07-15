"use client";

// Galerie de templates : recherche, filtres par catégorie, grille de cartes.
// Créer / éditer / supprimer, et deux actions d'usage (en faire un agent, ou
// l'ouvrir dans le Copilote).
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Template } from "@/lib/agent/store";

// Génère une teinte HSL depuis le nom de la catégorie (fonctionne pour n'importe quel nom)
function catHue(cat: string): number {
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) & 0xffff;
  return h % 360;
}
function catColor(cat: string): string {
  if (!cat) return "var(--muted)";
  return `hsl(${catHue(cat)}, 65%, 68%)`;
}
function catStyle(cat: string): React.CSSProperties {
  if (!cat) return {};
  const c = catColor(cat);
  return {
    color: c,
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
  category: string;
  prompt: string;
  icon: string;
}

const EMPTY: Form = {
  name: "",
  description: "",
  category: "Général",
  prompt: "",
  icon: "📋",
};

export default function TemplatesManager({
  templates,
  token,
  dbReady,
}: {
  templates: Template[];
  token: string;
  dbReady: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("Tous");

  const headers = { "Content-Type": "application/json", "x-app-token": token };

  const categories = useMemo(() => {
    const set = new Set(templates.map((t) => t.category));
    return ["Tous", ...Array.from(set).sort()];
  }, [templates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((t) => {
      if (cat !== "Tous" && t.category !== cat) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.prompt.toLowerCase().includes(q)
      );
    });
  }, [templates, query, cat]);

  function openNew() {
    const firstCat = categories.find((c) => c !== "Tous") ?? "Général";
    setForm({ ...EMPTY, category: firstCat });
    setError(null);
    setEditingId("new");
  }
  function openEdit(t: Template) {
    setForm({
      name: t.name,
      description: t.description,
      category: t.category,
      prompt: t.prompt,
      icon: t.icon,
    });
    setError(null);
    setEditingId(t.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!form.name.trim() || !form.prompt.trim()) {
      setError("Le nom et le prompt sont obligatoires.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const isNew = editingId === "new";
      const res = await fetch(
        isNew ? "/api/templates" : `/api/templates/${editingId}`,
        { method: isNew ? "POST" : "PATCH", headers, body: JSON.stringify(form) },
      );
      const data = await res.json();
      if (!res.ok) setError(data.error ?? `Erreur ${res.status}`);
      else {
        setEditingId(null);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: Template) {
    if (!confirm(`Supprimer le template « ${t.name} » ?`)) return;
    await fetch(`/api/templates/${t.id}`, { method: "DELETE", headers });
    router.refresh();
  }

  async function makeAgent(t: Template) {
    const res = await fetch("/api/agent/tasks", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: t.name,
        description: t.description,
        prompt: t.prompt,
        frequency: "daily",
        enabled: false,
      }),
    });
    if (res.ok) router.push(`/agent?token=${encodeURIComponent(token)}`);
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Impossible de créer l'agent.");
    }
  }

  function openInCopilote(t: Template) {
    router.push(
      `/copilote?token=${encodeURIComponent(token)}&q=${encodeURIComponent(t.prompt)}`,
    );
  }

  return (
    <div>
      {/* Barre d'actions */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div className="searchbar" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
          <input
            style={inputStyle}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un template…"
          />
        </div>
        <button onClick={openNew} disabled={!dbReady}>
          + Nouveau template
        </button>
      </div>

      {/* Filtres catégories */}
      <div className="chips">
        {categories.map((c) => (
          <button
            key={c}
            className={`chip ${cat === c ? "active" : ""}`}
            onClick={() => setCat(c)}
          >
            {c !== "Tous" && (
              <span style={{ color: catColor(c), fontSize: 10 }}>●</span>
            )}
            {c}
            {c !== "Tous" && (
              <span style={{ opacity: 0.6 }}>
                {" "}{templates.filter((t) => t.category === c).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {!dbReady && (
        <div
          className="card"
          style={{ marginBottom: 16, borderColor: "color-mix(in srgb, #fbbf24 40%, transparent)" }}
        >
          <strong>Base de données non branchée.</strong>
          <p className="subtitle" style={{ marginTop: 6, marginBottom: 0 }}>
            Ajoute Supabase dans Vercel pour gérer tes templates.
          </p>
        </div>
      )}

      {/* Formulaire de création / édition */}
      {editingId && (
        <div className="card" style={{ marginBottom: 16, background: "var(--surface-2)" }}>
          <h3 style={{ marginTop: 0 }}>
            {editingId === "new" ? "Nouveau template" : "Modifier le template"}
          </h3>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <label style={{ flex: 1, minWidth: 160 }}>
                <div className="subtitle" style={{ fontSize: 13, marginBottom: 4 }}>Nom</div>
                <input
                  style={inputStyle}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label style={{ width: 180 }}>
                <div className="subtitle" style={{ fontSize: 13, marginBottom: 4 }}>Catégorie</div>
                <select
                  style={inputStyle}
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {categories
                    .filter((c) => c !== "Tous")
                    .map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                </select>
              </label>
            </div>
            <label>
              <div className="subtitle" style={{ fontSize: 13, marginBottom: 4 }}>Description courte</div>
              <input
                style={inputStyle}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
            <label>
              <div className="subtitle" style={{ fontSize: 13, marginBottom: 4 }}>Prompt</div>
              <textarea
                style={{ ...inputStyle, minHeight: 120, resize: "vertical", fontFamily: "inherit" }}
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              />
            </label>
            {error && <div className="mono" style={{ color: "var(--red)" }}>{error}</div>}
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
        {filtered.length} template{filtered.length > 1 ? "s" : ""}
      </div>

      {/* Grille */}
      <div className="tpl-grid">
        {filtered.map((t) => (
          <div className="card interactive tpl-card" key={t.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>{t.name}</div>
              <span className="pill" style={{ fontSize: 11, padding: "2px 8px", flexShrink: 0, marginTop: 1, ...catStyle(t.category) }}>
                {t.category}
              </span>
            </div>
            {t.description && (
              <div className="subtitle" style={{ fontSize: 12.5, marginBottom: 10 }}>
                {t.description}
              </div>
            )}
            <div className="tpl-actions">
              <button className="btn-sm" onClick={() => openInCopilote(t)}>
                💬 Copilote
              </button>
              <button className="btn-ghost btn-sm" onClick={() => makeAgent(t)} disabled={!dbReady}>
                🤖 Agent
              </button>
              {dbReady && (
                <>
                  <button className="icon-btn" onClick={() => openEdit(t)} title="Modifier">
                    ✏️
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => remove(t)}
                    title="Supprimer"
                    style={{ color: "var(--red)" }}
                  >
                    🗑️
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card">
          <p className="subtitle" style={{ margin: 0 }}>
            Aucun template ne correspond. Change de catégorie ou de recherche.
          </p>
        </div>
      )}
    </div>
  );
}
