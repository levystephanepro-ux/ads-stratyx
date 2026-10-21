// Jauge rouge → vert du coût par vente : vert sous le CPA cible, orange jusqu'au CPA
// critique (seuil de perte), rouge au-delà. Le repère noir est le coût réel.
const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

export default function RentaGauge({ cpa, cible, critique, small }: { cpa: number | null; cible: number; critique: number; small?: boolean }) {
  if (critique <= 0) return null;
  const max = Math.max(critique * 1.5, (cpa ?? 0) * 1.1);
  const at = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  const h = small ? 8 : 16;
  return (
    <div style={{ minWidth: small ? 120 : 0 }} aria-label={cpa === null ? "Pas de vente mesurée" : `Coût par vente ${fmt(cpa)}`}>
      <div style={{ position: "relative", height: h, borderRadius: h, background: `linear-gradient(90deg, #2e9e5b 0, #2e9e5b ${at(cible)}, #e8a21a ${at(cible)}, #e8a21a ${at(critique)}, #d64545 ${at(critique)}, #d64545 100%)` }}>
        {cpa !== null && <span style={{ position: "absolute", left: at(cpa), top: -3, width: 4, height: h + 6, marginLeft: -2, background: "#111", border: "1px solid #fff", borderRadius: 2 }} />}
      </div>
      {!small && (
        <div style={{ position: "relative", height: 34, fontSize: 12, marginTop: 6 }}>
          <span style={{ position: "absolute", left: 0 }}>0 €</span>
          <span style={{ position: "absolute", left: at(cible), transform: "translateX(-50%)", textAlign: "center" }}>cible<br /><strong>{fmt(cible)}</strong></span>
          <span style={{ position: "absolute", left: at(critique), transform: "translateX(-50%)", textAlign: "center" }}>seuil de perte<br /><strong>{fmt(critique)}</strong></span>
          {cpa !== null && <span style={{ position: "absolute", right: 0, top: 0 }}>réel : <strong>{fmt(cpa)}</strong></span>}
        </div>
      )}
    </div>
  );
}
