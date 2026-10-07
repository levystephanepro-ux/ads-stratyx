"use client";
// Témoin lumineux toujours visible : vert = dernier bilan sans échec, rouge = problème,
// gris = aucun bilan récent. Clic : ouvre le Bilan de santé.
import { useEffect, useState } from "react";
import Link from "next/link";

interface Summary { at: string; fail: number; warn: number; failed: string[] }

export default function HealthLight() {
  const [sum, setSum] = useState<Summary | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/health/status", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { summary: null }))
        .then((d) => { if (alive) setSum(d.summary ?? null); })
        .catch(() => { if (alive) setSum(null); });
    load();
    const t = setInterval(load, 10 * 60 * 1000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const ageH = sum ? (Date.now() - new Date(sum.at).getTime()) / 36e5 : Infinity;
  const stale = ageH > 36;
  const state: "ok" | "fail" | "unknown" = !sum || stale ? "unknown" : sum.fail > 0 ? "fail" : "ok";

  const label = state === "ok" ? "Tout fonctionne" : state === "fail" ? `${sum!.fail} problème(s)` : sum === undefined ? "Vérification…" : "Bilan à lancer";
  const when = sum ? new Date(sum.at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  const title =
    state === "fail"
      ? `Dernier bilan ${when} :\n${sum!.failed.join("\n")}`
      : state === "ok"
        ? `Dernier bilan ${when}${sum!.warn ? ` · ${sum!.warn} point(s) à vérifier` : ""}`
        : sum ? `Dernier bilan trop ancien (${when}). Clique pour relancer.` : "Aucun bilan enregistré. Clique pour lancer.";

  return (
    <Link href="/admin/sante" className={`health-light health-${state}`} title={title}>
      <span className="health-dot" aria-hidden />
      <span className="health-text">{label}</span>
    </Link>
  );
}
