import { QUESTIONNAIRE, publicSections, type QSection } from "@/lib/clients/questions";

const field = { padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", width: "100%", font: "inherit" } as const;

/** mode "fiche" : toutes les questions, notes internes comprises. mode "public" / "court" : ce que voit le client. */
export default function QuestionFields({ answers, mode = "fiche" }: { answers: Record<string, string>; mode?: "fiche" | "public" | "court" }) {
  const sections: QSection[] = mode === "fiche" ? QUESTIONNAIRE : publicSections(mode === "court");
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {sections.map((s) => (
        <section key={s.title} className="card" style={{ display: "grid", gap: 14, ...(s.internal ? { borderColor: "var(--accent)" } : {}) }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{s.title}</h2>
          {s.intro && <p className="subtitle" style={{ margin: 0, fontSize: 13 }}>{s.intro}</p>}
          {s.questions.map((q) => {
            const val = answers[q.key] ?? "";
            const picked = val.split(",").map((x) => x.trim());
            return (
              <div key={q.key} style={{ display: "grid", gap: 5 }}>
                <label htmlFor={`q_${q.key}`} style={{ fontWeight: 600 }}>{q.label}</label>
                {q.help && <span className="subtitle" style={{ margin: 0, fontSize: 12 }}>{q.help}</span>}
                {q.type === "long" && <textarea id={`q_${q.key}`} name={q.key} rows={3} defaultValue={val} style={field} />}
                {q.type === "text" && <input id={`q_${q.key}`} name={q.key} defaultValue={val} style={field} />}
                {q.type === "number" && <input id={`q_${q.key}`} name={q.key} type="number" min={0} step="any" inputMode="decimal" defaultValue={val} style={field} />}
                {q.type === "choice" && (
                  <select id={`q_${q.key}`} name={q.key} defaultValue={val} style={field}>
                    <option value="">Choisir</option>
                    {q.choices!.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                {q.type === "multi" && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {q.choices!.map((c) => (
                      <label key={c} className="pill" style={{ cursor: "pointer", display: "inline-flex", gap: 6, alignItems: "center" }}>
                        <input type="checkbox" name={q.key} value={c} defaultChecked={picked.includes(c)} style={{ margin: 0 }} /> {c}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
