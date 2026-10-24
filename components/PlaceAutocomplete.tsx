"use client";
// Champ « fiche Google » avec suggestions pendant la frappe. Envoie le texte (fiche) et, si une
// suggestion est choisie, son identifiant Google (place_id) pour retrouver la bonne entreprise.
import { useEffect, useRef, useState } from "react";

interface Suggestion { id: string; main: string; secondary: string; business: boolean }

const box = { padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", width: "100%" } as const;

export default function PlaceAutocomplete({ placeholder }: { placeholder: string }) {
  const [text, setText] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const q = text.trim();
    if (placeId || q.length < 3) { setItems([]); setNote(null); return; }
    const n = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/audit/places?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        if (n !== seq.current) return;
        const json = (await res.json()) as { suggestions?: Suggestion[]; message?: string | null };
        setItems(json.suggestions ?? []);
        setNote(json.message ?? null);
        setOpen(true);
      } catch { if (n === seq.current) { setItems([]); setNote(null); } }
    }, 300);
    return () => clearTimeout(t);
  }, [text, placeId]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={wrap} style={{ position: "relative" }}>
      <input name="fiche" value={text} placeholder={placeholder} autoComplete="off" style={box}
        onChange={(e) => { setText(e.target.value); setPlaceId(""); }}
        onFocus={() => { if (items.length) setOpen(true); }} />
      <input type="hidden" name="place_id" value={placeId} />
      {open && (items.length > 0 || note) && (
        <ul role="listbox" style={{ position: "absolute", zIndex: 20, left: 0, right: 0, top: "100%", margin: "4px 0 0", padding: 4, listStyle: "none", maxHeight: 280, overflowY: "auto", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", boxShadow: "0 8px 24px rgba(0,0,0,.25)" }}>
          {items.map((s) => (
            <li key={s.id} role="option" aria-selected={false}
              onMouseDown={(e) => { e.preventDefault(); setText(s.secondary ? `${s.main}, ${s.secondary}` : s.main); setPlaceId(s.id); setOpen(false); }}
              style={{ padding: "8px 10px", cursor: "pointer", borderRadius: 6 }}>
              <div style={{ fontWeight: 600 }}>{s.main}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{s.business ? "Entreprise" : "Adresse"}{s.secondary ? ` · ${s.secondary}` : ""}</div>
            </li>
          ))}
          {items.length === 0 && note && <li style={{ padding: "8px 10px", fontSize: 12, opacity: 0.75 }}>{note}</li>}
        </ul>
      )}
      {placeId && <div style={{ fontSize: 12, marginTop: 4, opacity: 0.75 }}>Fiche choisie dans la liste Google. Modifiez le texte pour en chercher une autre.</div>}
    </div>
  );
}
