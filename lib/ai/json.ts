// Lecture tolérante d'un JSON renvoyé par l'IA : blocs ```json, texte autour,
// virgules en trop, réponse coupée (on referme chaînes, tableaux et objets).

function closeTruncated(s: string): string {
  const stack: string[] = [];
  let inStr = false, esc = false;
  for (const ch of s) {
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  let out = s;
  if (inStr) out += '"';
  // Retire une clé ou un élément laissé incomplet en fin de texte.
  out = out.replace(/,\s*"[^"]*"\s*:?\s*$/, "").replace(/[,:]\s*$/, "");
  return out + stack.reverse().join("");
}

/** Fin du premier bloc équilibré à partir de `start` (en ignorant le contenu des chaînes), ou -1. */
function balancedEnd(s: string, start: number): number {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") { depth--; if (depth === 0) return i; }
  }
  return -1;
}

const noTrailingCommas = (s: string) => s.replace(/,\s*([}\]])/g, "$1");

/** Extrait et parse le premier objet (ou tableau) JSON d'un texte. Lance une erreur si impossible. */
export function parseAiJson<T = unknown>(text: string, kind: "object" | "array" = "object"): T {
  const open = kind === "object" ? "{" : "[", close = kind === "object" ? "}" : "]";
  const t = text.replace(/```(?:json)?/gi, "");
  const start = t.indexOf(open);
  if (start < 0) throw new Error("no json");
  const end = t.lastIndexOf(close), bal = balancedEnd(t, start);
  const candidates = [
    bal > start ? t.slice(start, bal + 1) : "",
    end > start ? t.slice(start, end + 1) : "",
    t.slice(start),
  ].filter(Boolean);
  for (const c of candidates) {
    for (const v of [c, noTrailingCommas(c), noTrailingCommas(closeTruncated(c))]) {
      try { return JSON.parse(v) as T; } catch { /* essai suivant */ }
    }
  }
  throw new Error("invalid json");
}
