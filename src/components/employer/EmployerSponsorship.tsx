import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { Icon } from "../common/Icons";
import type { IconName } from "../common/Icons";
import { api } from "../../services/api";
import type { ChallengeCard, ChallengeDetail, ScholarshipCandidate, ScholarshipCard } from "../../services/api";

type Option = { id: string; name: string };

const LOAD_ERROR = "Ma’lumotni yuklab bo‘lmadi. Server ishlayotganini tekshiring.";

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

const hintStyle: CSSProperties = { display: "block", marginTop: 6, fontSize: 12, fontWeight: 500, color: "var(--muted)" };

const errText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDay = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};

const CHALLENGE_STATUS: Record<ChallengeCard["status"], { label: string; cls: string }> = {
  active: { label: "Faol", cls: "inv-status-accepted" },
  closed: { label: "Yakunlangan", cls: "inv-status-withdrawn" },
};

const SCHOLARSHIP_STATUS: Record<ScholarshipCard["status"], { label: string; cls: string }> = {
  open: { label: "Qabul ochiq", cls: "inv-status-accepted" },
  awarded: { label: "Berildi", cls: "inv-status-accepted" },
  closed: { label: "Yopilgan", cls: "inv-status-withdrawn" },
};

function Modal({ title, onClose, width = 560, children }: { title: string; onClose: () => void; width?: number; children: ReactNode }) {
  return (
    <div className="modal-backdrop employer-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal employer-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: `min(${width}px, 100%)`, borderRadius: 20, padding: 28 }}
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

function EmptyState({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <div style={{ padding: "36px 24px", textAlign: "center", color: "var(--muted)" }}>
      <div style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--surface-3)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
        <Icon name={icon} size={24} />
      </div>
      <h3 style={{ margin: "0 0 6px", color: "var(--navy)", fontSize: 17 }}>{title}</h3>
      <p style={{ margin: "0 auto", fontSize: 13.5, maxWidth: 440 }}>{text}</p>
    </div>
  );
}

function SectionHead({ icon, title, text, action, onAction }: { icon: IconName; title: string; text: string; action: string; onAction: () => void }) {
  return (
    <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", borderBottom: "1px solid var(--border)" }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--accent-soft)", color: "var(--royal)", display: "grid", placeItems: "center" }}>
        <Icon name={icon} size={20} />
      </div>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "var(--navy)" }}>{title}</h3>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{text}</div>
      </div>
      <button className="primary-button" type="button" onClick={onAction} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <Icon name="plus" size={15} /> {action}
      </button>
    </div>
  );
}

const rowStyle = (i: number): CSSProperties => ({
  padding: "14px 18px",
  borderTop: i === 0 ? 0 : "1px solid var(--border)",
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
});

export default function EmployerSponsorship() {
  const [challenges, setChallenges] = useState<ChallengeCard[]>([]);
  const [scholarships, setScholarships] = useState<ScholarshipCard[]>([]);
  const [careers, setCareers] = useState<Option[]>([]);
  const [universities, setUniversities] = useState<Option[]>([]);
  const [directions, setDirections] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [challengeFormOpen, setChallengeFormOpen] = useState(false);
  const [scholarshipFormOpen, setScholarshipFormOpen] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState<ChallengeCard | null>(null);
  const [activeScholarship, setActiveScholarship] = useState<ScholarshipCard | null>(null);

  const loadChallenges = () => api.getChallenges().then(setChallenges);
  const loadScholarships = () => api.getScholarships().then(setScholarships);

  const loadAll = async () => {
    setLoading(true);
    setPageError(null);
    try {
      await Promise.all([loadChallenges(), loadScholarships()]);
    } catch (err) {
      setPageError(errText(err, LOAD_ERROR));
      setLoading(false);
      return;
    }
    try {
      const list = await api.getCareers();
      setCareers(
        (Array.isArray(list) ? list : [])
          .map((c: any) => ({ id: String(c.id), name: String(c.roleName ?? c.role_name ?? c.name ?? c.id) }))
          .filter((c) => c.id),
      );
    } catch {
      setCareers([]);
    }
    try {
      const t = await api.getSponsorshipTargets();
      setUniversities(t.universities ?? []);
      setDirections(t.directions ?? []);
    } catch {
      setUniversities([]);
      setDirections([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const closeChallenge = async (c: ChallengeCard) => {
    if (confirmId !== c.id) {
      setConfirmId(c.id);
      return;
    }
    setRowError(null);
    setBusyId(c.id);
    try {
      await api.closeChallenge(c.id);
      setConfirmId(null);
      await loadChallenges();
    } catch (err) {
      setRowError(errText(err, "Tanlovni yakunlab bo‘lmadi"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page">
      <section className="welcome-row">
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>HOMIYLIK</p>
          <h1>Homiylik</h1>
          <p className="subtitle">Tanlov yoki stipendiya orqali kuchli talabalarni erta toping. Natijalarni platforma baholaydi — homiy ta’sir qila olmaydi.</p>
        </div>
      </section>

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Yuklanmoqda…</div>
      ) : pageError ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>
          <div style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--surface-3)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Icon name="alert" size={24} />
          </div>
          <p style={{ margin: "0 auto 16px", fontSize: 13.5, maxWidth: 460 }}>{pageError}</p>
          <button className="secondary-button" type="button" onClick={() => void loadAll()} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Icon name="refresh" size={15} /> Qayta urinish
          </button>
        </div>
      ) : (
        <>
          {rowError && <div className="card" style={{ padding: "12px 16px", color: "var(--rose)", fontWeight: 600, fontSize: 13 }}>{rowError}</div>}

          <section className="card" style={{ padding: 0, overflow: "hidden" }}>
            <SectionHead
              icon="trophy"
              title="Tanlovlar"
              text="Kasb bo‘yicha topshiriqlar to‘plami — talabalar bajaradi, platforma baholaydi."
              action="Yangi tanlov"
              onAction={() => setChallengeFormOpen(true)}
            />
            {challenges.length === 0 ? (
              <EmptyState icon="trophy" title="Hali tanlov yo‘q" text="Birinchi tanlovni e’lon qiling — eng yaxshi natija ko‘rsatgan talabalarni ko‘rasiz." />
            ) : (
              challenges.map((c, i) => {
                const st = CHALLENGE_STATUS[c.status] ?? CHALLENGE_STATUS.closed;
                const active = c.status === "active";
                const confirming = confirmId === c.id;
                return (
                  <div key={c.id} style={rowStyle(i)}>
                    <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "var(--navy)" }}>{c.title}</h3>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        {c.task_count} ta topshiriq · {c.participants} ishtirokchi · {fmtDay(c.ends_at)} gacha
                        {c.prize_note ? ` · ${c.prize_note}` : ""}
                      </div>
                    </div>
                    <span className={`inv-status ${st.cls}`}>{st.label}</span>
                    <button type="button" className="candidate-evidence-btn" style={{ flex: "0 0 auto" }} onClick={() => setActiveChallenge(c)}>
                      <Icon name="chart" size={16} />
                      <span>Natijalar</span>
                    </button>
                    {active && (
                      <>
                        <button
                          type="button"
                          className={confirming ? "secondary-button" : "ghost-button"}
                          disabled={busyId === c.id}
                          onClick={() => void closeChallenge(c)}
                          style={{ fontSize: 12.5, padding: "7px 11px", whiteSpace: "nowrap", ...(confirming ? { color: "var(--rose)" } : {}) }}
                        >
                          {busyId === c.id ? "…" : confirming ? "Tasdiqlash" : "Yakunlash"}
                        </button>
                        {confirming && busyId !== c.id && (
                          <button type="button" className="text-button" onClick={() => setConfirmId(null)} style={{ fontSize: 12.5 }}>
                            Bekor qilish
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })
            )}
          </section>

          <section className="card" style={{ padding: 0, overflow: "hidden" }}>
            <SectionHead
              icon="award"
              title="Stipendiyalar"
              text="Stipendiyani universitet reyting asosida beradi; siz top nomzodlarni ko‘rasiz."
              action="Yangi stipendiya"
              onAction={() => setScholarshipFormOpen(true)}
            />
            {scholarships.length === 0 ? (
              <EmptyState icon="award" title="Hali stipendiya yo‘q" text="Stipendiya ta’sis qiling — universitet reytingdagi eng kuchli talabalarga beradi." />
            ) : (
              scholarships.map((s, i) => {
                const st = SCHOLARSHIP_STATUS[s.status] ?? SCHOLARSHIP_STATUS.closed;
                return (
                  <div key={s.id} style={rowStyle(i)}>
                    <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "var(--navy)" }}>{s.title}</h3>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        {[s.university ?? "—", s.direction, s.amount_note].filter(Boolean).join(" · ")}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600, marginTop: 2 }}>
                        {s.slots} o‘rin · berilgan: {s.awarded}
                        {s.deadline ? ` · ${fmtDay(s.deadline)} gacha` : ""}
                      </div>
                    </div>
                    <span className={`inv-status ${st.cls}`}>{st.label}</span>
                    <button type="button" className="candidate-evidence-btn" style={{ flex: "0 0 auto" }} onClick={() => setActiveScholarship(s)}>
                      <Icon name="users" size={16} />
                      <span>Nomzodlar</span>
                    </button>
                  </div>
                );
              })
            )}
          </section>
        </>
      )}

      {challengeFormOpen && (
        <ChallengeForm
          careers={careers}
          onClose={() => setChallengeFormOpen(false)}
          onCreated={() => {
            setChallengeFormOpen(false);
            void loadChallenges().catch(() => setRowError(LOAD_ERROR));
          }}
        />
      )}

      {scholarshipFormOpen && (
        <ScholarshipForm
          universities={universities}
          directions={directions}
          onClose={() => setScholarshipFormOpen(false)}
          onCreated={() => {
            setScholarshipFormOpen(false);
            void loadScholarships().catch(() => setRowError(LOAD_ERROR));
          }}
        />
      )}

      {activeChallenge && <ResultsModal challenge={activeChallenge} onClose={() => setActiveChallenge(null)} />}
      {activeScholarship && <ScholarshipCandidatesModal scholarship={activeScholarship} onClose={() => setActiveScholarship(null)} />}
    </div>
  );
}

function ChallengeForm({ careers, onClose, onCreated }: { careers: Option[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: "", career_id: "", days: "30", prize_note: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const days = Math.floor(Number(form.days));
    if (!form.title.trim()) return setError("Tanlov nomini kiriting");
    if (!form.career_id) return setError("Kasbni tanlang");
    if (!Number.isFinite(days) || days < 1) return setError("Muddat kamida 1 kun bo‘lishi kerak");
    setSaving(true);
    setError(null);
    try {
      await api.createChallenge({
        title: form.title.trim(),
        career_id: form.career_id,
        days,
        prize_note: form.prize_note.trim() || null,
        description: form.description.trim() || null,
      });
      onCreated();
    } catch (err) {
      setError(errText(err, "Tanlovni yaratib bo‘lmadi"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Yangi tanlov" onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <label style={{ gridColumn: "1 / -1" }}>
          Nomi
          <input value={form.title} onChange={set("title")} placeholder="Masalan: Backend Challenge 2026" required />
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          Kasb
          {careers.length === 0 ? (
            <div style={{ marginTop: 7, color: "var(--rose)", fontWeight: 600, fontSize: 13 }}>Kasblar ro‘yxati yuklanmadi</div>
          ) : (
            <select value={form.career_id} onChange={set("career_id")} required style={selectStyle}>
              <option value="">Kasbni tanlang</option>
              {careers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <span style={hintStyle}>Topshiriqlar shu kasb ko‘nikmalaridan avtomatik tanlanadi.</span>
        </label>
        <label>
          Muddat (kun)
          <input type="number" min={1} step={1} value={form.days} onChange={set("days")} required />
        </label>
        <label>
          Mukofot
          <input value={form.prize_note} onChange={set("prize_note")} placeholder="Masalan: amaliyot taklifi" />
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          Tavsif
          <textarea value={form.description} onChange={set("description")} />
        </label>
        <div style={{ gridColumn: "1 / -1" }}>
          <button className="primary-button full" type="submit" disabled={saving || careers.length === 0}>
            {saving ? "Saqlanmoqda…" : "Tanlovni e’lon qilish"}
          </button>
          <InlineError text={error} />
        </div>
      </form>
    </Modal>
  );
}

function ScholarshipForm({
  universities,
  directions,
  onClose,
  onCreated,
}: {
  universities: Option[];
  directions: Option[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    university_org_id: "",
    title: "",
    amount_note: "",
    slots: "3",
    direction_id: "",
    deadline_days: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const slots = Math.floor(Number(form.slots));
    const deadline = form.deadline_days.trim() ? Math.floor(Number(form.deadline_days)) : null;
    if (!form.university_org_id) return setError("Universitetni tanlang");
    if (!form.title.trim()) return setError("Stipendiya nomini kiriting");
    if (!Number.isFinite(slots) || slots < 1) return setError("O‘rinlar soni kamida 1 bo‘lishi kerak");
    if (deadline !== null && (!Number.isFinite(deadline) || deadline < 1)) return setError("Muddat kamida 1 kun bo‘lishi kerak");
    setSaving(true);
    setError(null);
    try {
      await api.createScholarship({
        university_org_id: form.university_org_id,
        title: form.title.trim(),
        amount_note: form.amount_note.trim() || null,
        slots,
        direction_id: form.direction_id || null,
        deadline_days: deadline,
        description: form.description.trim() || null,
      });
      onCreated();
    } catch (err) {
      setError(errText(err, "Stipendiyani yaratib bo‘lmadi"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Yangi stipendiya" onClose={onClose}>
      <p style={{ margin: "-6px 0 16px", fontSize: 13, color: "var(--muted)" }}>Stipendiyani universitet reyting asosida beradi; siz top nomzodlarni ko‘rasiz.</p>
      <form className="form-grid" onSubmit={submit}>
        <label style={{ gridColumn: "1 / -1" }}>
          Universitet
          {universities.length === 0 ? (
            <div style={{ marginTop: 7, color: "var(--rose)", fontWeight: 600, fontSize: 13 }}>Universitetlar ro‘yxati yuklanmadi</div>
          ) : (
            <select value={form.university_org_id} onChange={set("university_org_id")} required style={selectStyle}>
              <option value="">Universitetni tanlang</option>
              {universities.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          Nomi
          <input value={form.title} onChange={set("title")} placeholder="Masalan: Iqtidorli dasturchilar stipendiyasi" required />
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          Miqdori
          <input value={form.amount_note} onChange={set("amount_note")} placeholder="masalan: oyiga 1 mln so‘m, 1 semestr" />
        </label>
        <label>
          O‘rinlar soni
          <input type="number" min={1} step={1} value={form.slots} onChange={set("slots")} required />
        </label>
        <label>
          Qabul muddati (kun)
          <input type="number" min={1} step={1} value={form.deadline_days} onChange={set("deadline_days")} placeholder="Ixtiyoriy" />
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          Yo‘nalish
          <select value={form.direction_id} onChange={set("direction_id")} style={selectStyle}>
            <option value="">Butun universitet</option>
            {directions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          Tavsif
          <textarea value={form.description} onChange={set("description")} />
        </label>
        <div style={{ gridColumn: "1 / -1" }}>
          <button className="primary-button full" type="submit" disabled={saving || universities.length === 0}>
            {saving ? "Saqlanmoqda…" : "Stipendiyani e’lon qilish"}
          </button>
          <InlineError text={error} />
        </div>
      </form>
    </Modal>
  );
}

function ResultsModal({ challenge, onClose }: { challenge: ChallengeCard; onClose: () => void }) {
  const [detail, setDetail] = useState<ChallengeDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getChallenge(challenge.id)
      .then(setDetail)
      .catch(() => setLoadError(LOAD_ERROR));
  }, [challenge.id]);

  const board = detail?.leaderboard ?? [];

  return (
    <Modal title={`Natijalar — ${challenge.title}`} onClose={onClose} width={600}>
      {loadError ? (
        <div style={{ color: "var(--rose)", fontWeight: 600, fontSize: 13 }}>{loadError}</div>
      ) : detail === null ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Natijalar yuklanmoqda…</div>
      ) : board.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Hali ishtirokchi yo‘q.</div>
      ) : (
        <>
          <div style={{ border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            {board.map((r, i) => (
              <div key={`${r.rank}-${i}`} style={{ padding: "12px 14px", borderTop: i === 0 ? 0 : "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 24, color: "var(--muted)", fontWeight: 800, fontSize: 13 }}>{r.rank}</span>
                <strong style={{ flex: "1 1 auto", minWidth: 0, fontSize: 14.5, color: "var(--navy)" }}>{r.name}</strong>
                <span className="vc-chip">{Math.round(r.score)} ball</span>
              </div>
            ))}
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--muted)" }}>Ismlar faqat talaba roziligi bilan ko‘rsatiladi.</p>
        </>
      )}
    </Modal>
  );
}

function ScholarshipCandidatesModal({ scholarship, onClose }: { scholarship: ScholarshipCard; onClose: () => void }) {
  const [candidates, setCandidates] = useState<ScholarshipCandidate[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getScholarshipCandidates(scholarship.id)
      .then((d) => setCandidates(d.candidates))
      .catch(() => setLoadError(LOAD_ERROR));
  }, [scholarship.id]);

  return (
    <Modal title={`Nomzodlar — ${scholarship.title}`} onClose={onClose} width={600}>
      {loadError ? (
        <div style={{ color: "var(--rose)", fontWeight: 600, fontSize: 13 }}>{loadError}</div>
      ) : candidates === null ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Nomzodlar yuklanmoqda…</div>
      ) : candidates.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Reytingda hali nomzod yo‘q.</div>
      ) : (
        <>
          <div style={{ border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            {candidates.map((c, i) => (
              <div key={c.user_id ?? `${c.rank}-${i}`} style={{ padding: "12px 14px", borderTop: i === 0 ? 0 : "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ width: 24, color: "var(--muted)", fontWeight: 800, fontSize: 13 }}>{c.rank}</span>
                <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                  <strong style={{ fontSize: 14.5, color: "var(--navy)" }}>{c.name}</strong>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{c.group ?? "—"}</div>
                </div>
                <span className="vc-chip">{Math.round(c.score)} ball</span>
                {c.awarded && (
                  <span className="inv-status inv-status-accepted">
                    <Icon name="checkCircle" size={13} /> Berilgan
                  </span>
                )}
              </div>
            ))}
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--muted)" }}>Ismlar faqat talaba roziligi bilan ko‘rsatiladi.</p>
        </>
      )}
    </Modal>
  );
}
