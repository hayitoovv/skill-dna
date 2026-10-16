import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { Icon } from "../common/Icons";
import { api } from "../../services/api";
import type { BankQuestion, BankStat, ImportReport } from "../../services/api";

type StatusFilter = "draft" | "approved" | "rejected" | "all";

const LOAD_ERROR = "Ma’lumotni yuklab bo‘lmadi. Server ishlayotganini tekshiring.";
const DIFFICULTIES = ["L1", "L2", "L3", "L4", "L5"];

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "draft", label: "Kutilmoqda" },
  { key: "approved", label: "Tasdiqlangan" },
  { key: "rejected", label: "Rad etilgan" },
  { key: "all", label: "Hammasi" },
];

const STATUS_LABELS: Record<BankQuestion["status"], string> = {
  draft: "Kutilmoqda",
  approved: "Tasdiqlangan",
  rejected: "Rad etilgan",
};

const STATUS_CLASS: Record<BankQuestion["status"], string> = {
  draft: "inv-status-sent",
  approved: "inv-status-accepted",
  rejected: "inv-status-declined",
};

const SOURCE_LABELS: Record<BankQuestion["source"], string> = {
  seed: "Boshlang‘ich",
  manual: "Qo‘lda",
  ai: "AI",
  import: "Import",
};

const SAMPLE_CSV =
  "skill_code;savol;A;B;C;D;togri_javob;izoh;daraja\n" +
  "SE-SQL;WHERE bo‘yicha tez-tez qidiriladigan ustun uchun nima qo‘shiladi?;Indeks;Trigger;View;Sequence;A;Indeks qidiruvni tezlashtiradi;L2\n";

const selectStyle: CSSProperties = {
  width: "100%",
  display: "block",
  marginTop: 7,
  padding: "11px 14px",
  borderRadius: 13,
  border: "1px solid var(--border)",
  background: "var(--surface-3)",
  color: "var(--ink)",
  font: "500 14px Geist, sans-serif",
};

const smallBtn: CSSProperties = { fontSize: 12.5, padding: "7px 11px", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6 };

const errText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

function Modal({ title, onClose, width = 560, children }: { title: string; onClose: () => void; width?: number; children: ReactNode }) {
  return (
    <div className="modal-backdrop employer-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal employer-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: `min(${width}px, 100%)`, borderRadius: 20, padding: 28, maxHeight: "92vh", overflowY: "auto" }}
      >
        <button className="modal-close" type="button" aria-label="Yopish" onClick={onClose}>
          <Icon name="close" />
        </button>
        <h2 style={{ margin: "0 0 18px", paddingRight: 30 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function InlineError({ text }: { text: string | null }) {
  if (!text) return null;
  return <div style={{ color: "var(--rose)", fontWeight: 600, fontSize: 13, marginTop: 12 }}>{text}</div>;
}

function SkillSelect({ stats, value, onChange, allowAll }: { stats: BankStat[]; value: string; onChange: (v: string) => void; allowAll?: boolean }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
      <option value="">{allowAll ? "Barcha ko‘nikmalar" : "Ko‘nikmani tanlang"}</option>
      {stats.map((s) => (
        <option key={s.skill_id} value={s.skill_id}>
          {s.code} — {s.name}
        </option>
      ))}
    </select>
  );
}

export default function QuestionBank({ role }: { role: "teacher" | "moderator" }) {
  const [stats, setStats] = useState<BankStat[]>([]);
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [skillId, setSkillId] = useState("");
  const [status, setStatus] = useState<StatusFilter>(role === "moderator" ? "draft" : "all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const [formTarget, setFormTarget] = useState<BankQuestion | "new" | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  const reqId = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const loadStats = () =>
    api
      .getBankStats()
      .then((s) => setStats(Array.isArray(s) ? s : []))
      .catch(() => {});

  const loadList = async () => {
    const id = ++reqId.current;
    setLoading(true);
    setListError(null);
    try {
      const list = await api.getBankQuestions({
        skillId: skillId || undefined,
        status: status === "all" ? undefined : status,
        q: query || undefined,
      });
      if (id === reqId.current) setQuestions(Array.isArray(list) ? list : []);
    } catch (err) {
      if (id === reqId.current) setListError(errText(err, LOAD_ERROR));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  };

  const reload = () => {
    void loadStats();
    void loadList();
  };

  useEffect(() => {
    void loadStats();
  }, []);

  useEffect(() => {
    void loadList();
  }, [skillId, status, query]);

  const lowCount = stats.filter((s) => s.approved < 10).length;

  return (
    <div className="page">
      <section className="welcome-row">
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>SAVOLLAR BANKI</p>
          <h1>Savollar banki</h1>
          <p className="subtitle">
            Har bir talaba testda bankdan tasodifiy 10 ta savol oladi. Savol talabalarga ko‘rinishi uchun boshqa o‘qituvchi yoki moderator tasdiqlashi kerak.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="secondary-button" type="button" onClick={() => setAiOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Icon name="sparkles" size={15} /> AI bilan yaratish
          </button>
          <button className="secondary-button" type="button" onClick={() => setCsvOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Icon name="file" size={15} /> CSV import
          </button>
          <button className="primary-button" type="button" onClick={() => setFormTarget("new")} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Icon name="plus" size={15} /> Savol qo‘shish
          </button>
        </div>
      </section>

      {stats.length > 0 && (
        <section className="card" style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--navy)" }}>Ko‘nikmalar bo‘yicha qamrov</h3>
            {lowCount > 0 && (
              <span className="vc-chip vc-chip-warn">
                <Icon name="alert" size={13} /> {lowCount} ta ko‘nikmada savol kam
              </span>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 8 }}>
            {stats.map((s) => {
              const low = s.approved < 10;
              const active = skillId === s.skill_id;
              const pct = s.target > 0 ? Math.min(100, Math.round((s.approved / s.target) * 100)) : 0;
              return (
                <button
                  key={s.skill_id}
                  type="button"
                  onClick={() => setSkillId(active ? "" : s.skill_id)}
                  title={s.name}
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: `1px solid ${active ? "var(--royal)" : low ? "var(--warning-ring)" : "var(--border)"}`,
                    background: low ? "var(--warning-soft)" : "var(--surface-3)",
                    color: "var(--ink)",
                    font: "inherit",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <strong style={{ fontSize: 12, color: low ? "var(--warning-fg)" : "var(--royal)" }}>{s.code}</strong>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--navy)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                      {s.name}
                    </span>
                    {low && <span style={{ fontSize: 11, fontWeight: 800, color: "var(--warning-fg)" }}>kam</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
                    {s.approved} tasdiqlangan · {s.draft} kutilmoqda
                  </div>
                  <div style={{ height: 4, borderRadius: 4, background: "var(--border)", marginTop: 7, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: low ? "var(--warning-fg)" : "var(--success)" }} />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "0 1 260px", minWidth: 180 }}>
          <SkillSelect stats={stats} value={skillId} onChange={setSkillId} allowAll />
        </div>
        <div className="filter-tabs" style={{ marginTop: 7 }}>
          {STATUS_TABS.map((t) => (
            <button key={t.key} type="button" className={status === t.key ? "active" : ""} onClick={() => setStatus(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ flex: "1 1 200px", position: "relative", marginTop: 7 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", display: "flex" }}>
            <Icon name="search" size={15} />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Savol matni bo‘yicha qidirish"
            style={{ ...selectStyle, marginTop: 0, paddingLeft: 36 }}
          />
        </div>
      </section>

      {notice && (
        <div className="card" style={{ padding: "12px 16px", color: "var(--success)", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="checkCircle" size={15} /> <span style={{ flex: 1 }}>{notice}</span>
          <button className="text-button" type="button" onClick={() => setNotice(null)} aria-label="Yopish">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {loading && questions.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Yuklanmoqda…</div>
      ) : listError ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>
          <div style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--surface-3)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Icon name="alert" size={24} />
          </div>
          <p style={{ margin: "0 auto 16px", fontSize: 13.5, maxWidth: 460 }}>{listError}</p>
          <button className="secondary-button" type="button" onClick={reload} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Icon name="refresh" size={15} /> Qayta urinish
          </button>
        </div>
      ) : questions.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>
          <div style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--surface-3)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Icon name="filter" size={24} />
          </div>
          <h3 style={{ margin: 0, color: "var(--navy)", fontSize: 16 }}>Bu filtrlar bo‘yicha savollar yo‘q</h3>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12, opacity: loading ? 0.6 : 1, transition: "opacity .2s" }}>
          {questions.map((q) => (
            <QuestionCard key={q.id} q={q} onChanged={reload} onEdit={() => setFormTarget(q)} />
          ))}
        </div>
      )}

      {formTarget && (
        <QuestionForm
          stats={stats}
          question={formTarget === "new" ? null : formTarget}
          defaultSkillId={skillId}
          onClose={() => setFormTarget(null)}
          onSaved={(msg) => {
            setFormTarget(null);
            setNotice(msg);
            reload();
          }}
        />
      )}

      {aiOpen && (
        <AiModal
          stats={stats}
          defaultSkillId={skillId}
          onClose={() => setAiOpen(false)}
          onDone={(sid, msg) => {
            setNotice(msg);
            setSkillId(sid);
            setStatus("draft");
            reload();
          }}
        />
      )}

      {csvOpen && (
        <CsvModal
          onClose={() => setCsvOpen(false)}
          onImported={(msg) => {
            setCsvOpen(false);
            setNotice(msg);
            reload();
          }}
        />
      )}
    </div>
  );
}

function QuestionCard({ q, onChanged, onEdit }: { q: BankQuestion; onChanged: () => void; onEdit: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setRejecting(false);
      setConfirmDelete(false);
      onChanged();
    } catch (err) {
      setError(errText(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const meta = [q.skill_code ?? q.skill ?? "—", q.difficulty, SOURCE_LABELS[q.source] ?? q.source, q.author].filter(Boolean).join(" · ");

  return (
    <article className="card" style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, flex: "1 1 280px", minWidth: 0, fontSize: 15, fontWeight: 700, color: "var(--navy)", lineHeight: 1.45 }}>{q.text}</h3>
        <span className={`inv-status ${STATUS_CLASS[q.status]}`}>{STATUS_LABELS[q.status]}</span>
      </div>

      <ol style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "grid", gap: 6 }}>
        {q.options.map((opt, i) => {
          const correct = i === q.answer_index;
          return (
            <li
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 11px",
                borderRadius: 10,
                fontSize: 13.5,
                border: `1px solid ${correct ? "var(--success-ring)" : "var(--border)"}`,
                background: correct ? "var(--success-soft)" : "transparent",
                color: correct ? "var(--success)" : "var(--text-2)",
                fontWeight: correct ? 700 : 500,
              }}
            >
              <span style={{ width: 18, fontWeight: 800, color: correct ? "var(--success)" : "var(--muted)" }}>{String.fromCharCode(65 + i)}</span>
              <span style={{ flex: 1, minWidth: 0 }}>{opt}</span>
              {correct && <Icon name="check" size={15} />}
            </li>
          );
        })}
      </ol>

      {q.explanation && <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--muted)" }}>{q.explanation}</p>}

      {q.status === "rejected" && q.review_note && (
        <div style={{ marginTop: 10, fontSize: 13, color: "var(--rose)", fontWeight: 600 }}>Rad etish sababi: {q.review_note}</div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <span style={{ flex: "1 1 200px", fontSize: 12, color: "var(--muted)" }}>{meta}</span>

        {q.status === "draft" && !rejecting && (
          <>
            <button
              type="button"
              className="secondary-button"
              style={smallBtn}
              disabled={busy}
              onClick={() => void run(() => api.reviewBankQuestion(q.id, "approve"), "Tasdiqlab bo‘lmadi")}
            >
              <Icon name="check" size={14} /> Tasdiqlash
            </button>
            <button type="button" className="ghost-button" style={smallBtn} disabled={busy} onClick={() => setRejecting(true)}>
              <Icon name="close" size={14} /> Rad etish
            </button>
          </>
        )}

        <button type="button" className="text-button" disabled={busy} onClick={onEdit}>
          <Icon name="edit" size={14} /> Tahrirlash
        </button>

        {confirmDelete ? (
          <>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--rose)" }}>O‘chirilsinmi?</span>
            <button
              type="button"
              className="ghost-button"
              style={{ ...smallBtn, color: "var(--rose)" }}
              disabled={busy}
              onClick={() => void run(() => api.deleteBankQuestion(q.id), "O‘chirib bo‘lmadi")}
            >
              {busy ? "…" : "Ha, o‘chirish"}
            </button>
            <button type="button" className="text-button" disabled={busy} onClick={() => setConfirmDelete(false)}>
              Bekor qilish
            </button>
          </>
        ) : (
          <button type="button" className="text-button" style={{ color: "var(--rose)" }} disabled={busy} onClick={() => setConfirmDelete(true)}>
            <Icon name="trash" size={14} /> O‘chirish
          </button>
        )}
      </div>

      {rejecting && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Rad etish sababi (ixtiyoriy)"
            autoFocus
            style={{ ...selectStyle, marginTop: 0, flex: "1 1 240px", width: "auto" }}
          />
          <button
            type="button"
            className="ghost-button"
            style={{ ...smallBtn, color: "var(--rose)" }}
            disabled={busy}
            onClick={() => void run(() => api.reviewBankQuestion(q.id, "reject", note.trim() || undefined), "Rad etib bo‘lmadi")}
          >
            {busy ? "…" : "Rad etish"}
          </button>
          <button type="button" className="text-button" disabled={busy} onClick={() => setRejecting(false)}>
            Bekor qilish
          </button>
        </div>
      )}

      <InlineError text={error} />
    </article>
  );
}

function QuestionForm({
  stats,
  question,
  defaultSkillId,
  onClose,
  onSaved,
}: {
  stats: BankStat[];
  question: BankQuestion | null;
  defaultSkillId: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const editing = question !== null;
  const [skillId, setSkillId] = useState(question?.skill_id ?? defaultSkillId);
  const [text, setText] = useState(question?.text ?? "");
  const [options, setOptions] = useState<string[]>(question ? [...question.options] : ["", "", "", ""]);
  const [answer, setAnswer] = useState<number>(question ? question.answer_index : -1);
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [difficulty, setDifficulty] = useState(question?.difficulty ?? "L2");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setOption = (i: number, v: string) => setOptions((o) => o.map((x, j) => (j === i ? v : x)));
  const addOption = () => setOptions((o) => (o.length < 6 ? [...o, ""] : o));
  const removeOption = (i: number) => {
    if (options.length <= 2) return;
    setOptions((o) => o.filter((_, j) => j !== i));
    setAnswer((a) => (a === i ? -1 : a > i ? a - 1 : a));
  };

  const validate = (): string | null => {
    if (!editing && !skillId) return "Ko‘nikmani tanlang";
    if (text.trim().length < 5) return "Savol matni kamida 5 belgidan iborat bo‘lishi kerak";
    const filled = options.map((o) => o.trim()).filter(Boolean);
    if (filled.length < 2) return "Kamida 2 ta javob varianti kiriting";
    if (new Set(filled.map((o) => o.toLowerCase())).size !== filled.length) return "Javob variantlari takrorlanmasligi kerak";
    if (answer < 0 || answer >= options.length || !options[answer]?.trim()) return "To‘g‘ri javobni belgilang";
    return null;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) return setError(v);
    const trimmed = options.map((o) => o.trim());
    const kept = trimmed.filter(Boolean);
    const answer_index = kept.indexOf(trimmed[answer]);
    const body = {
      text: text.trim(),
      options: kept,
      answer_index,
      explanation: explanation.trim() || null,
      difficulty,
    };
    setSaving(true);
    setError(null);
    try {
      if (question) {
        await api.updateBankQuestion(question.id, body);
        onSaved("Savol yangilandi va qayta tasdiqlashga yuborildi.");
      } else {
        await api.createBankQuestion({ skill_id: skillId, ...body });
        onSaved("Savol qoralama sifatida qo‘shildi — boshqa o‘qituvchi yoki moderator tasdiqlashi kerak.");
      }
    } catch (err) {
      setError(errText(err, "Savolni saqlab bo‘lmadi"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={editing ? "Savolni tahrirlash" : "Yangi savol"} onClose={onClose} width={620}>
      <form className="form-grid" onSubmit={submit}>
        {!editing && (
          <label style={{ gridColumn: "1 / -1" }}>
            Ko‘nikma
            <SkillSelect stats={stats} value={skillId} onChange={setSkillId} />
          </label>
        )}
        <label style={{ gridColumn: "1 / -1" }}>
          Savol matni
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Savolni yozing" />
        </label>

        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)", marginBottom: 7 }}>Javob variantlari (to‘g‘risini belgilang)</div>
          <div style={{ display: "grid", gap: 7 }}>
            {options.map((opt, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="radio"
                  name="correct-answer"
                  checked={answer === i}
                  onChange={() => setAnswer(i)}
                  aria-label={`To‘g‘ri javob: ${String.fromCharCode(65 + i)}`}
                  style={{ width: 17, height: 17, accentColor: "var(--success)", flex: "0 0 auto" }}
                />
                <span style={{ width: 16, fontWeight: 800, color: "var(--muted)", fontSize: 13 }}>{String.fromCharCode(65 + i)}</span>
                <input
                  value={opt}
                  onChange={(e) => setOption(i, e.target.value)}
                  placeholder={`Variant ${String.fromCharCode(65 + i)}`}
                  style={{ ...selectStyle, marginTop: 0, flex: 1, width: "auto", borderColor: answer === i ? "var(--success-ring)" : "var(--border)" }}
                />
                <button
                  type="button"
                  className="text-button"
                  aria-label="Variantni o‘chirish"
                  disabled={options.length <= 2}
                  onClick={() => removeOption(i)}
                  style={{ color: options.length <= 2 ? "var(--muted)" : "var(--rose)" }}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))}
          </div>
          {options.length < 6 && (
            <button type="button" className="text-button" onClick={addOption} style={{ marginTop: 9 }}>
              <Icon name="plus" size={14} /> Variant qo‘shish
            </button>
          )}
        </div>

        <label style={{ gridColumn: "1 / -1" }}>
          Izoh (ixtiyoriy)
          <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Nega bu javob to‘g‘ri?" />
        </label>
        <label>
          Daraja
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={selectStyle}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <div style={{ gridColumn: "1 / -1" }}>
          <button className="primary-button full" type="submit" disabled={saving}>
            {saving ? "Saqlanmoqda…" : editing ? "Saqlash" : "Savolni qo‘shish"}
          </button>
          <InlineError text={error} />
        </div>
      </form>
    </Modal>
  );
}

function AiModal({
  stats,
  defaultSkillId,
  onClose,
  onDone,
}: {
  stats: BankStat[];
  defaultSkillId: string;
  onClose: () => void;
  onDone: (skillId: string, msg: string) => void;
}) {
  const [skillId, setSkillId] = useState(defaultSkillId);
  const [count, setCount] = useState("10");
  const [difficulty, setDifficulty] = useState("L2");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Math.floor(Number(count));
    if (!skillId) return setError("Ko‘nikmani tanlang");
    if (!Number.isFinite(n) || n < 1 || n > 20) return setError("Savollar soni 1 dan 20 gacha bo‘lishi kerak");
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.generateBankQuestions({ skill_id: skillId, count: n, difficulty, topic: topic.trim() || null });
      const msg = `${res.created.length} ta savol qoralama sifatida qo‘shildi — tekshirib tasdiqlang.`;
      setResult(res.skipped > 0 ? `${msg} (${res.skipped} ta takroriy yoki noto‘g‘ri savol o‘tkazib yuborildi)` : msg);
      onDone(skillId, msg);
    } catch (err) {
      setError(errText(err, "AI savollarni yarata olmadi"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="AI bilan savol yaratish" onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <label style={{ gridColumn: "1 / -1" }}>
          Ko‘nikma
          <SkillSelect stats={stats} value={skillId} onChange={setSkillId} />
        </label>
        <label>
          Savollar soni
          <input type="number" min={1} max={20} step={1} value={count} onChange={(e) => setCount(e.target.value)} />
        </label>
        <label>
          Daraja
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={selectStyle}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          Mavzu (ixtiyoriy)
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Masalan: JOIN turlari" />
        </label>
        <div style={{ gridColumn: "1 / -1" }}>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--muted)" }}>
            AI yaratgan savollar qoralama bo‘ladi — talabalarga ko‘rinishidan oldin ularni tekshirib tasdiqlash kerak.
          </p>
          <button className="primary-button full" type="submit" disabled={busy} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Icon name="sparkles" size={15} /> {busy ? "AI savollar tuzmoqda…" : "Yaratish"}
          </button>
          {result && <div style={{ color: "var(--success)", fontWeight: 600, fontSize: 13, marginTop: 12 }}>{result}</div>}
          <InlineError text={error} />
        </div>
      </form>
    </Modal>
  );
}

function CsvModal({ onClose, onImported }: { onClose: () => void; onImported: (msg: string) => void }) {
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadSample = () => {
    const blob = new Blob(["﻿" + SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "savollar_namuna.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const preview = async (text: string) => {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      setReport(await api.importBankQuestions(text, true));
    } catch (err) {
      setError(errText(err, "Faylni tekshirib bo‘lmadi"));
    } finally {
      setBusy(false);
    }
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result.replace(/^﻿/, "") : "";
      setCsv(text);
      void preview(text);
    };
    reader.onerror = () => setError("Faylni o‘qib bo‘lmadi");
    reader.readAsText(file, "utf-8");
  };

  const doImport = async () => {
    if (!csv) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.importBankQuestions(csv, false);
      onImported(`${res.created} ta savol qoralama sifatida import qilindi — tekshirib tasdiqlang.`);
    } catch (err) {
      setError(errText(err, "Import qilib bo‘lmadi"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="CSV orqali import" onClose={onClose} width={620}>
      <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55 }}>
        <p style={{ margin: "0 0 8px" }}>
          Fayl nuqtali vergul (;) bilan ajratilgan bo‘lishi kerak. Ustunlar:
        </p>
        <code style={{ display: "block", padding: "9px 12px", borderRadius: 10, background: "var(--surface-3)", border: "1px solid var(--border)", fontSize: 12, overflowX: "auto", whiteSpace: "nowrap" }}>
          skill_code;savol;A;B;C;D;togri_javob;izoh;daraja
        </code>
        <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 12.5 }}>
          togri_javob — to‘g‘ri variant harfi (A–F), daraja — L1…L5. Excel’da faylni «CSV UTF-8» sifatida saqlang. Import qilingan savollar qoralama bo‘ladi.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 16 }}>
        <button type="button" className="secondary-button" onClick={downloadSample} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <Icon name="download" size={15} /> Namuna faylni yuklab olish
        </button>
        <label className="ghost-button" style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
          <Icon name="file" size={15} /> {fileName || "Faylni tanlash"}
          <input
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {busy && !report && <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 13 }}>Tekshirilmoqda…</div>}

      {report && (
        <div style={{ marginTop: 16, border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span className="inv-status inv-status-accepted">
              <Icon name="check" size={13} /> {report.valid} ta to‘g‘ri
            </span>
            <span className={`inv-status ${report.errors.length ? "inv-status-declined" : "inv-status-withdrawn"}`}>
              <Icon name="alert" size={13} /> {report.errors.length} ta xato
            </span>
          </div>
          {report.errors.length > 0 && (
            <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", maxHeight: 200, overflowY: "auto", display: "grid", gap: 4 }}>
              {report.errors.map((er, i) => (
                <li key={i} style={{ fontSize: 12.5, color: "var(--rose)" }}>
                  <strong>{er.line !== null ? `${er.line}-qator:` : "Fayl:"}</strong> {er.errors.join("; ")}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="primary-button full"
            disabled={busy || report.valid === 0}
            onClick={() => void doImport()}
            style={{ marginTop: 14 }}
          >
            {busy ? "Import qilinmoqda…" : `Import qilish (${report.valid} ta)`}
          </button>
        </div>
      )}

      <InlineError text={error} />
    </Modal>
  );
}
