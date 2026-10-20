"use client";
// Bouton de formulaire (server action) qui demande une confirmation avant d'envoyer.
import type { CSSProperties, ReactNode } from "react";

export default function ConfirmButton({ action, message, children, className, style }: {
  action: (form: FormData) => void | Promise<void>;
  message: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="submit"
      formAction={action}
      className={className}
      style={style}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
