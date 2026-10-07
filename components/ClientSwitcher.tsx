"use client";
// Sélecteur du client actif (barre latérale) : toutes les pages suivent son compte Google Ads.
// Menu maison (un <select> ne peut pas afficher d'icône) : client actif en premier, coche, identifiant du compte.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Item { id: string; name: string; linked: boolean; customerId?: string | null }

const fmtId = (id?: string | null) => {
  const d = (id ?? "").replace(/\D/g, "");
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d;
};

// Logo Google Ads officiel à déposer dans public/google-ads.svg ; repli : pastille neutre.
function AdsMark() {
  const [ok, setOk] = useState(true);
  if (!ok) return <span className="cs-mark-fallback" aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/google-ads.svg" alt="" width={16} height={16} className="cs-mark" onError={() => setOk(false)} />;
}

export default function ClientSwitcher() {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [active, setActive] = useState<string>("");
  const [base, setBase] = useState<{ customerId: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/clients/active", { cache: "no-store" }).then((r) => r.json()).then((j) => { setItems(j.clients ?? []); setActive(j.active ?? ""); setBase(j.defaultAccount ?? null); }).catch(() => setItems([]));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!items || items.length === 0) return null;

  const change = async (id: string) => {
    setOpen(false);
    if (id === active) return;
    setBusy(true); setActive(id);
    await fetch("/api/clients/active", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: id || null }) }).catch(() => undefined);
    setBusy(false);
    router.refresh();
  };

  const none: Item = { id: "", name: base ? `Aucun client (${base.name})` : "Aucun client", linked: true, customerId: base?.customerId ?? null };
  const all = [...items, none];
  const current = all.find((c) => c.id === active) ?? none;
  // Le client actif en premier, puis les autres dans l'ordre de la liste.
  const ordered = [current, ...all.filter((c) => c.id !== current.id)];

  return (
    <div className="cs" ref={box}>
      <div className="cs-label">Client actif</div>
      <button type="button" className="cs-trigger" disabled={busy} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <AdsMark />
        <span className="cs-name">{current.name}</span>
        <span className={`cs-chev${open ? " open" : ""}`} aria-hidden>⌄</span>
      </button>
      {open && (
        <ul className="cs-menu" role="listbox">
          {ordered.map((c) => {
            const sel = c.id === current.id;
            return (
              <li key={c.id || "none"}>
                <button type="button" role="option" aria-selected={sel} className={`cs-opt${sel ? " sel" : ""}`} onClick={() => change(c.id)}>
                  <AdsMark />
                  <span className="cs-opt-txt">
                    <span className="cs-opt-name">{c.name}</span>
                    <span className="cs-opt-id">{c.id === "" ? (c.customerId ? `${fmtId(c.customerId)} · compte par défaut` : "Compte par défaut") : c.customerId ? fmtId(c.customerId) : "Sans compte Google Ads"}</span>
                  </span>
                  {sel && <span className="cs-check" aria-hidden>✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
