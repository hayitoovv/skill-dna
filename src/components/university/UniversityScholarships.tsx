import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Icon } from "../common/Icons";
import { api, type ScholarshipCandidate, type ScholarshipCard } from "../../services/api";

const LOAD_ERROR = "Ma’lumotni yuklab bo‘lmadi. Server ishlayotganini tekshiring.";

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(9, 9, 11, 0.65)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: "16px",
};
const modalStyle: CSSProperties = {
  width: "100%",
  padding: "26px",
  borderRadius: "14px",
  background: "white",
  boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
  maxHeight: "calc(100vh - 32px)",
  overflowY: "auto",
};
const mutedText: CSSProperties = { margin: 0, fontSize: "13.5px", color: "var(--muted)" };
const th: CSSProperties = { padding: "8px 10px" };
const td: CSSProperties = { padding: "10px" };
const theadRow: CSSProperties = { textAlign: "left", color: "var(--muted)", fontSize: "12px", textTransform: "uppercase" };
const pillBase: CSSProperties = {
  display: "inline-block",
  padding: "1px 8px",
  borderRadius: "999px",
  fontSize: "11.5px",
  fontWeight: 700,
  whiteSpace: "nowrap",
  border: "1px solid var(--border-soft)",
};

const STATUS: Record<ScholarshipCard["status"], { label: string; style: CSSProperties }> = {
  open: { label: "Qabul ochiq", style: { color: "#067647", background: "#ecfdf3", borderColor: "#abefc6" } },
  awarded: { label: "Berildi", style: { color: "var(--royal)", background: "var(--surface-2)" } },
  closed: { label: "Yopilgan", style: { color: "var(--muted)", background: "var(--surface-2)" } },
};

function DemoPill() {
  return (
    <span
      title="Namuna ma’lumot — haqiqiy ko‘rsatkich emas"
      style={{
        marginLeft: "8px",
        padding: "1px 7px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 600,
        color: "var(--muted)",
        background: "var(--surface-2)",
        border: "1px solid var(--border-soft)",
        verticalAlign: "middle",
      }}
    >
      namuna
    </span>
  );
}

function StatusChip({ status }: { status: ScholarshipCard["status"] }) {
  const s = STATUS[status] ?? STATUS.closed;
  return <span style={{ ...pillBase, ...s.style }}>{s.label}</span>;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

const errText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

function CandidatesModal({ scholarship, onClose, onAwarded }: { scholarship: ScholarshipCard; onClose: () => void; onAwarded: () => void }) {
  const [data, setData] = useState<{ slots: number; status: string; candidates: ScholarshipCandidate[] } | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    api
      .getScholarshipCandidates(scholarship.id)
      .then((d) => {
        setData(d);
        setError(false);
      })
      .catch(() => setError(true));
  }, [scholarship.id]);

  useEffect(() => {
    load();
  }, [load]);

  const awardedCount = data ? data.candidates.filter((c) => c.awarded).length : 0;
  const remaining = data ? Math.max(0, data.slots - awardedCount) : 0;
  const left = remaining - selected.size;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < remaining) next.add(id);
      return next;
    });

  const award = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    setMsg(null);
    try {
      await api.awardScholarship(scholarship.id, [...selected]);
      setSelected(new Set());
      setMsg({ ok: true, text: "Stipendiya berildi. Talabalarga bildirishnoma yuborildi." });
      load();
      onAwarded();
    } catch (err) {
      setMsg({ ok: false, text: errText(err, "Stipendiyani berib bo‘lmadi.") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="scholarship-candidates-title" style={overlayStyle} onClick={onClose}>
      <div className="card" style={{ ...modalStyle, maxWidth: "720px" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "12px" }}>
          <h3 id="scholarship-candidates-title" style={{ margin: 0, fontSize: "18px", color: "var(--navy)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Icon name="award" size={18} /> {scholarship.title}
          </h3>
          <button onClick={onClose} aria-label="Yopish" style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--subtle)" }}>
            <Icon name="close" size={18} />
          </button>
        </div>

        {error ? (
          <p style={mutedText}>{LOAD_ERROR}</p>
        ) : !data ? (
          <p style={mutedText}>Yuklanmoqda…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ ...mutedText, fontSize: "13px" }}>
              {[scholarship.company, scholarship.amount_note].filter(Boolean).join(" · ") || "—"} · {data.slots} o‘rin · berilgan: {awardedCount}
              {remaining > 0 && (
                <strong style={{ marginLeft: "8px", color: "var(--navy)" }}>Yana {Math.max(0, left)} ta o‘rin bor</strong>
              )}
            </p>

            {data.candidates.length === 0 ? (
              <p style={mutedText}>Hozircha nomzodlar yo‘q.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                  <thead>
                    <tr style={theadRow}>
                      <th style={{ ...th, width: "36px" }} aria-label="Tanlash" />
                      <th style={{ ...th, textAlign: "right" }}>O‘rin</th>
                      <th style={th}>Talaba</th>
                      <th style={th}>Guruh</th>
                      <th style={{ ...th, textAlign: "right" }}>Ball</th>
                      <th style={th} />
                    </tr>
                  </thead>
                  <tbody>
                    {data.candidates.map((c) => {
                      const id = c.user_id;
                      const checked = id != null && selected.has(id);
                      const disabled = c.awarded || id == null || (!checked && left <= 0);
                      return (
                        <tr key={id ?? `rank-${c.rank}`} style={{ borderTop: "1px solid var(--border-soft)" }}>
                          <td style={td}>
                            {!c.awarded && (
                              <input
                                type="checkbox"
                                aria-label={`${c.name} ni tanlash`}
                                checked={checked}
                                disabled={disabled}
                                onChange={() => id && toggle(id)}
                              />
                            )}
                          </td>
                          <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "var(--navy)" }}>{c.rank}</td>
                          <td style={{ ...td, fontWeight: 600, color: "var(--navy)" }}>{c.name}</td>
                          <td style={{ ...td, color: "var(--muted)" }}>{c.group ?? "—"}</td>
                          <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "var(--navy)" }}>{c.score}</td>
                          <td style={td}>{c.awarded && <span style={{ ...pillBase, ...STATUS.awarded.style }}>Berilgan</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              {msg && <span style={{ fontSize: "13px", color: msg.ok ? "var(--muted)" : "var(--danger, #b42318)" }}>{msg.text}</span>}
              <button type="button" className="secondary-button" onClick={onClose}>
                Yopish
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={saving || selected.size === 0}
                onClick={award}
                style={{ padding: "8px 18px", borderRadius: "8px" }}
              >
                {saving ? "Saqlanmoqda…" : "Stipendiyani berish"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Scholarships that companies have allocated to this university's students. */
export default function UniversityScholarships() {
  const [items, setItems] = useState<ScholarshipCard[] | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<ScholarshipCard | null>(null);

  const load = useCallback(() => {
    api
      .getScholarships()
      .then((s) => {
        setItems(s);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="card" style={{ padding: "22px", marginTop: "18px" }}>
      <div style={{ marginBottom: "14px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 800, color: "var(--navy)", margin: 0 }}>Stipendiyalar</h2>
        <p style={{ margin: "2px 0 0", fontSize: "13.5px", color: "var(--muted)" }}>
          Korxonalar universitetingiz talabalari uchun ajratgan stipendiyalar. Reyting bo‘yicha nomzodlarni tanlab, stipendiyani bering.
        </p>
      </div>

      {error ? (
        <p style={mutedText}>{LOAD_ERROR}</p>
      ) : !items ? (
        <p style={mutedText}>Yuklanmoqda…</p>
      ) : items.length === 0 ? (
        <p style={mutedText}>Hozircha stipendiyalar yo‘q</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={theadRow}>
                <th style={th}>Stipendiya</th>
                <th style={th}>Korxona</th>
                <th style={th}>Miqdor</th>
                <th style={th}>O‘rinlar</th>
                <th style={th}>Yo‘nalish</th>
                <th style={th}>Muddat</th>
                <th style={th}>Holat</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                  <td style={{ ...td, fontWeight: 600, color: "var(--navy)" }}>
                    {s.title}
                    {s.description?.toLowerCase().includes("namuna") && <DemoPill />}
                  </td>
                  <td style={{ ...td, color: "var(--text-2)" }}>{s.company ?? "—"}</td>
                  <td style={{ ...td, color: "var(--text-2)" }}>{s.amount_note ?? "—"}</td>
                  <td style={{ ...td, color: "var(--text-2)", whiteSpace: "nowrap" }}>
                    {s.slots} o‘rin · berilgan: {s.awarded}
                  </td>
                  <td style={{ ...td, color: "var(--muted)" }}>{s.direction ?? "Butun universitet"}</td>
                  <td style={{ ...td, color: "var(--muted)", whiteSpace: "nowrap" }}>{formatDate(s.deadline)}</td>
                  <td style={td}>
                    <StatusChip status={s.status} />
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button type="button" className="secondary-button" onClick={() => setOpen(s)} style={{ whiteSpace: "nowrap" }}>
                      Nomzodlar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <CandidatesModal scholarship={open} onClose={() => setOpen(null)} onAwarded={load} />}
    </section>
  );
}
