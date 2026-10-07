import { QUESTIONNAIRE } from "@/lib/clients/questions";

const field = { padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", width: "100%", font: "inherit" } as const;

export default function QuestionFields({ answers }: { answers: Record<string, string> }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {QUESTIONNAIRE.map((s) => (
        <section key={s.title} className="card" style={{ display: "grid", gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{s.title}</h2>
          {s.questions.map((q) => (
            <label key={q.key} style={{ display: "grid", gap: 5 }}>
              <span style={{ fontWeight: 600 }}>{q.label}</span>
              {q.help && <span className="subtitle" style={{ margin: 0, fontSize: 12 }}>{q.help}</span>}
              {q.type === "long" && <textarea name={q.key} rows={3} defaultValue={answers[q.key] ?? ""} style={field} />}
              {q.type === "text" && <input name={q.key} defaultValue={answers[q.key] ?? ""} style={field} />}
              {q.type === "number" && <input name={q.key} type="number" min={0} step="any" inputMode="decimal" defaultValue={answers[q.key] ?? ""} style={field} />}
              {q.type === "choice" && (
                <select name={q.key} defaultValue={answers[q.key] ?? ""} style={field}>
                  <option value="">Choisir</option>
                  {q.choices!.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </label>
          ))}
        </section>
      ))}
    </div>
  );
}
