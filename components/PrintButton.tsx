"use client";
export default function PrintButton({ label = "Télécharger en PDF" }: { label?: string }) {
  return <button className="btn no-print" onClick={() => window.print()}>{label}</button>;
}
