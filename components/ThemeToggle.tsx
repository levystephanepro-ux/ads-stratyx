"use client";

import { useEffect, useState } from "react";
import { Icons } from "@/components/Icons";

// Thème clair par défaut ; le choix « sombre » est mémorisé dans le navigateur.

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("light");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ads-theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch { /* stockage indisponible */ }
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("ads-theme", next); } catch { /* ignoré */ }
  }

  return (
    <button
      onClick={toggle}
      className="side-link"
      style={{
        width: "100%",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        justifyContent: "flex-start",
        fontWeight: 500,
      }}
    >
      <span className="side-ic">{theme === "dark" ? Icons.sun : Icons.moon}</span>
      <span>{theme === "dark" ? "Thème clair" : "Thème sombre"}</span>
    </button>
  );
}
