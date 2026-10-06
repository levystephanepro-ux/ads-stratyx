"use client";
// Bouton de formulaire (server action) qui montre que l'action tourne.
import { useFormStatus } from "react-dom";
import type { CSSProperties, ReactNode } from "react";

export default function SubmitButton({ children, pending, className, style }: {
  children: ReactNode; pending: string; className?: string; style?: CSSProperties;
}) {
  const { pending: busy } = useFormStatus();
  return (
    <button type="submit" className={className} style={{ ...style, opacity: busy ? 0.7 : 1, cursor: busy ? "wait" : undefined }} disabled={busy} aria-busy={busy}>
      {busy ? pending : children}
    </button>
  );
}
