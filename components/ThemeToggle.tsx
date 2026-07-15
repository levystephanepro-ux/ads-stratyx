"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("ads-theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
    else if (document.documentElement.getAttribute("data-theme") === "light") setTheme("light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("ads-theme", next);
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
      <span className="side-ic">{theme === "dark" ? "☀️" : "🌙"}</span>
      <span>{theme === "dark" ? "Thème clair" : "Thème sombre"}</span>
    </button>
  );
}
