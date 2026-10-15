"use client";
export default function PrintButton({ label = "Télécharger en PDF", className = "btn" }: { label?: string; className?: string }) {
  return <button type="button" className={`${className} no-print`} onClick={() => window.print()}>{label}</button>;
}
