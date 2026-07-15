// Envoi d'email via Resend (https://resend.com — offre gratuite généreuse).
// On appelle l'API REST directement (fetch natif) : pas de SDK à installer.
//
// Config (env) :
//   RESEND_API_KEY   — clé API Resend (obligatoire pour envoyer).
//   AGENT_EMAIL_TO   — destinataire (ton email).
//   AGENT_EMAIL_FROM — expéditeur. Défaut : onboarding@resend.dev (marche sans
//                      vérifier de domaine, mais uniquement vers TON email Resend).

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export async function sendAgentEmail(
  subject: string,
  markdown: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.AGENT_EMAIL_TO;
  const from =
    process.env.AGENT_EMAIL_FROM ?? "ads-stratyx <onboarding@resend.dev>";

  if (!apiKey || !to) {
    throw new Error(
      "Email non configuré : renseigne RESEND_API_KEY et AGENT_EMAIL_TO dans Vercel.",
    );
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html: renderHtml(subject, markdown) }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Envoi email échoué (Resend ${res.status}) : ${body}`);
  }
}

// --- Mini convertisseur Markdown → HTML ---
// L'agent renvoie du markdown (titres, gras, listes, tableaux). On le transforme
// en HTML lisible dans un client mail. Volontairement minimal mais robuste.
function renderHtml(title: string, md: string): string {
  const body = mdToHtml(md);
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#0b0b12;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#ececf2">
<div style="max-width:640px;margin:0 auto;background:#14141f;border:1px solid #2a2a3d;border-radius:14px;padding:28px">
<div style="font-weight:700;font-size:15px;color:#a78bfa;margin-bottom:18px">ads·stratyx <span style="color:#9a9ab0;font-weight:500">· Agent IA</span></div>
${body}
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #2a2a3d;color:#9a9ab0;font-size:12px">Rapport généré automatiquement — ${escapeHtml(title)}</div>
</div></body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code style="background:#1c1c2b;padding:1px 5px;border-radius:5px">$1</code>');
}

function mdToHtml(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Tableau markdown : une ligne "| … |" suivie d'une ligne de séparation "|---|".
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? "")) {
      closeList();
      const header = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      out.push(renderTable(header, rows));
      continue;
    }

    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      closeList();
      const size = h[1].length === 1 ? 20 : h[1].length === 2 ? 17 : 15;
      out.push(`<div style="font-weight:700;font-size:${size}px;margin:18px 0 8px">${inline(h[2])}</div>`);
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) {
        out.push('<ul style="margin:8px 0;padding-left:20px">');
        inList = true;
      }
      out.push(`<li style="margin:4px 0">${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`);
      i++;
      continue;
    }

    if (line.trim() === "") {
      closeList();
      i++;
      continue;
    }

    closeList();
    out.push(`<p style="margin:8px 0;line-height:1.5">${inline(line)}</p>`);
    i++;
  }
  closeList();
  return out.join("\n");
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

function renderTable(header: string[], rows: string[][]): string {
  const th = header
    .map(
      (c) =>
        `<th style="text-align:left;padding:8px 10px;border-bottom:1px solid #2a2a3d;color:#9a9ab0;font-size:12px;text-transform:uppercase">${inline(c)}</th>`,
    )
    .join("");
  const trs = rows
    .map(
      (r) =>
        `<tr>${r
          .map(
            (c) =>
              `<td style="padding:8px 10px;border-bottom:1px solid #2a2a3d;font-size:14px">${inline(c)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;margin:12px 0"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}
