'use client'
// Petite visite guidée à la première ouverture d'une page (« 1 sur 2 », Compris).
// Mémorisée dans le navigateur ; « Comment ça marche » reste disponible ensuite.
import { useEffect, useState } from "react";

export default function Tour({ id, steps }: { id: string; steps: { title: string; text: string }[] }) {
  const [i, setI] = useState<number | null>(null);
  const key = `stratyx-tour:${id}`;
  useEffect(() => {
    try { if (!localStorage.getItem(key)) setI(0); } catch { /* stockage indisponible : pas de visite */ }
  }, [key]);
  if (i === null || !steps.length) return null;
  const done = () => { try { localStorage.setItem(key, "1"); } catch { /* rien */ } setI(null); };
  const s = steps[i];
  return (
    <div className="tour-backdrop" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-card">
        <div className="tour-top">
          <span className="tour-step">{s.title.split(" · ")[0]} · {i + 1} sur {steps.length}</span>
          <button type="button" className="tour-x" onClick={done} aria-label="Fermer">×</button>
        </div>
        <h3 id="tour-title">{s.title.split(" · ").slice(1).join(" · ") || s.title}</h3>
        <p>{s.text}</p>
        <div className="tour-foot">
          <span className="tour-dots">{steps.map((_, k) => <span key={k} className={k === i ? "on" : ""} />)}</span>
          {i < steps.length - 1
            ? <button type="button" className="ui-btn ui-btn-primary" onClick={() => setI(i + 1)}>Suivant →</button>
            : <button type="button" className="ui-btn ui-btn-primary" onClick={done}>Compris</button>}
        </div>
      </div>
    </div>
  );
}
