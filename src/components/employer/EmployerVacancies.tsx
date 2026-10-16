import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { Icon } from "../common/Icons";
import { ApiError, api } from "../../services/api";
import type { CompanyCard, EmployerPlan, EmploymentType, Vacancy, VacancyCandidate } from "../../services/api";

type MyCompany = CompanyCard & { plan: EmployerPlan };
type CareerOption = { id: string; name: string };

const LOAD_ERROR = "Ma’lumotni yuklab bo‘lmadi. Server ishlayotganini tekshiring.";

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  full_time: "To‘liq stavka",
  part_time: "Yarim stavka",
  internship: "Amaliyot (stajyor)",
};

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

const errText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDay = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
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

export default function EmployerVacancies() {
  const [company, setCompany] = useState<MyCompany | null>(null);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [careers, setCareers] = useState<CareerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeVacancy, setActiveVacancy] = useState<Vacancy | null>(null);

  const refreshCompany = () =>
    api
      .getMyCompany()
      .then(setCompany)
      .catch(() => {});

  const loadVacancies = () => api.getMyVacancies().then(setVacancies);

  const loadAll = async () => {
    setLoading(true);
    setPageError(null);
    try {
      const me = await api.getMyCompany();
      setCompany(me);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setPageError(msg.includes("korxonaga biriktirilmagan") ? msg : LOAD_ERROR);
      setLoading(false);
      return;
    }
    try {
      await loadVacancies();
    } catch {
      setPageError(LOAD_ERROR);
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
    setLoading(false);
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const toggleStatus = async (v: Vacancy) => {
    setRowError(null);
    setBusyId(v.id);
    try {
      await api.updateVacancy(v.id, { status: v.status === "open" ? "closed" : "open" });
      await loadVacancies();
    } catch (err) {
      setRowError(errText(err, "Vakansiya holatini o‘zgartirib bo‘lmadi"));
    } finally {
      setBusyId(null);
    }
  };

  const plan = company?.plan;

  return (
    <div className="page">
      <section className="welcome-row">
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>VAKANSIYALAR</p>
          <h1>Vakansiyalar</h1>
          <p className="subtitle">Vakansiyani kasbga bog‘lang — tizim mos nomzodlarni ko‘nikmalari bo‘yicha saralaydi.</p>
        </div>
        {company && (
          <button
            className="primary-button"
            type="button"
            onClick={() => setCreateOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
          >
            <Icon name="plus" size={15} /> Yangi vakansiya
          </button>
        )}
      </section>

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Yuklanmoqda…</div>
      ) : pageError && !company ? (
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
        company && (
          <>
            {plan && (
              <section className="card" style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13 }}>
                <span className={`inv-status ${plan.tier === "pro" ? "inv-status-accepted" : "inv-status-withdrawn"}`}>
                  <Icon name="mail" size={13} /> Tarif: {plan.label}
                </span>
                <span style={{ color: "var(--text-2)", fontWeight: 600 }}>
                  bu oy {plan.used}/{plan.limit} taklif · {fmtDay(plan.resets_on)} da yangilanadi
                </span>
                {plan.tier === "free" && (
                  <span style={{ color: "var(--muted)", fontSize: 12.5 }}>Ko‘proq taklif uchun Pro tarif — administrator bilan bog‘laning.</span>
                )}
              </section>
            )}

            <section className="card" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--accent-soft)", color: "var(--royal)", display: "grid", placeItems: "center" }}>
                <Icon name="building" size={20} />
              </div>
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "var(--navy)" }}>{company.name}</h3>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  {[company.industry, company.region].filter(Boolean).join(" · ") || "Soha va hudud ko‘rsatilmagan"}
                  {company.website && (
                    <>
                      {" · "}
                      <a href={company.website} target="_blank" rel="noreferrer" style={{ color: "var(--royal)" }}>
                        {company.website}
                      </a>
                    </>
                  )}
                </div>
              </div>
              <button className="text-button" type="button" onClick={() => setEditOpen(true)}>
                <Icon name="edit" size={14} /> Tahrirlash
              </button>
            </section>

            {(rowError || pageError) && (
              <div className="card" style={{ padding: "12px 16px", color: "var(--rose)", fontWeight: 600, fontSize: 13 }}>{rowError ?? pageError}</div>
            )}

            {vacancies.length === 0 ? (
              <div className="card" style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>
                <div style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--surface-3)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
                  <Icon name="briefcase" size={24} />
                </div>
                <h3 style={{ margin: "0 0 6px", color: "var(--navy)", fontSize: 17 }}>Hali vakansiya yo‘q</h3>
                <p style={{ margin: "0 auto", fontSize: 13.5, maxWidth: 440 }}>
                  Birinchi vakansiyani qo‘shing — tizim unga mos nomzodlarni avtomatik saralaydi.
                </p>
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                {vacancies.map((v, i) => {
                  const open = v.status === "open";
                  return (
                    <div key={v.id} style={{ padding: "14px 18px", borderTop: i === 0 ? 0 : "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                        <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "var(--navy)" }}>{v.title}</h3>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                          {v.career ?? "—"} · {EMPLOYMENT_LABELS[v.employment_type] ?? v.employment_type} · {v.openings} o‘rin
                          {v.city ? ` · ${v.city}` : ""}
                        </div>
                      </div>
                      <span className={`inv-status ${open ? "inv-status-accepted" : "inv-status-withdrawn"}`}>{open ? "Ochiq" : "Yopilgan"}</span>
                      <button
                        type="button"
                        className="candidate-evidence-btn"
                        style={{ flex: "0 0 auto" }}
                        onClick={() => setActiveVacancy(v)}
                      >
                        <Icon name="users" size={16} />
                        <span>Nomzodlar</span>
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={busyId === v.id}
                        onClick={() => void toggleStatus(v)}
                        style={{ fontSize: 12.5, padding: "7px 11px", whiteSpace: "nowrap" }}
                      >
                        {busyId === v.id ? "…" : open ? "Yopish" : "Qayta ochish"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )
      )}

      {editOpen && company && (
        <CompanyForm
          company={company}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            void refreshCompany();
          }}
        />
      )}

      {createOpen && (
        <VacancyForm
          careers={careers}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            void loadVacancies().catch(() => setPageError(LOAD_ERROR));
          }}
        />
      )}

      {activeVacancy && (
        <CandidatesModal vacancy={activeVacancy} onClose={() => setActiveVacancy(null)} onInvited={() => void refreshCompany()} />
      )}
    </div>
  );
}

function CompanyForm({ company, onClose, onSaved }: { company: MyCompany; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: company.name ?? "",
    industry: company.industry ?? "",
    region: company.region ?? "",
    website: company.website ?? "",
    about: company.about ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Korxona nomini kiriting");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.updateMyCompany({
        name: form.name.trim(),
        industry: form.industry.trim() || null,
        region: form.region.trim() || null,
        website: form.website.trim() || null,
        about: form.about.trim() || null,
      });
      onSaved();
    } catch (err) {
      setError(errText(err, "Saqlab bo‘lmadi"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Korxona profili" onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <label style={{ gridColumn: "1 / -1" }}>
          Nomi
          <input value={form.name} onChange={set("name")} required />
        </label>
        <label>
          Soha
          <input value={form.industry} onChange={set("industry")} placeholder="Masalan: IT xizmatlari" />
        </label>
        <label>
          Hudud
          <input value={form.region} onChange={set("region")} placeholder="Masalan: Toshkent" />
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          Veb-sayt
          <input value={form.website} onChange={set("website")} placeholder="https://" />
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          Korxona haqida
          <textarea value={form.about} onChange={set("about")} />
        </label>
        <div style={{ gridColumn: "1 / -1" }}>
          <button className="primary-button full" type="submit" disabled={saving}>
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
          <InlineError text={error} />
        </div>
      </form>
    </Modal>
  );
}

function VacancyForm({ careers, onClose, onCreated }: { careers: CareerOption[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: "",
    career_id: "",
    openings: "1",
    employment_type: "full_time" as EmploymentType,
    city: "",
    salary_note: "",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const openings = Math.floor(Number(form.openings));
    if (!form.title.trim()) return setError("Lavozim nomini kiriting");
    if (!form.career_id) return setError("Kasbni tanlang");
    if (!Number.isFinite(openings) || openings < 1) return setError("O‘rinlar soni kamida 1 bo‘lishi kerak");
    setSaving(true);
    setError(null);
    try {
      await api.createVacancy({
        title: form.title.trim(),
        career_id: form.career_id,
        openings,
        employment_type: form.employment_type,
        city: form.city.trim() || null,
        salary_note: form.salary_note.trim() || null,
        description: form.description.trim() || null,
      });
      onCreated();
    } catch (err) {
      setError(errText(err, "Vakansiyani yaratib bo‘lmadi"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Yangi vakansiya" onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <label style={{ gridColumn: "1 / -1" }}>
          Lavozim
          <input value={form.title} onChange={set("title")} placeholder="Masalan: Junior Backend Developer" required />
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
        </label>
        <label>
          O‘rinlar soni
          <input type="number" min={1} step={1} value={form.openings} onChange={set("openings")} required />
        </label>
        <label>
          Bandlik turi
          <select value={form.employment_type} onChange={set("employment_type")} style={selectStyle}>
            {(Object.keys(EMPLOYMENT_LABELS) as EmploymentType[]).map((k) => (
              <option key={k} value={k}>
                {EMPLOYMENT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Shahar
          <input value={form.city} onChange={set("city")} placeholder="Masalan: Toshkent" />
        </label>
        <label>
          Maosh
          <input value={form.salary_note} onChange={set("salary_note")} placeholder="Masalan: kelishiladi" />
        </label>
        <label style={{ gridColumn: "1 / -1" }}>
          Tavsif
          <textarea value={form.description} onChange={set("description")} />
        </label>
        <div style={{ gridColumn: "1 / -1" }}>
          <button className="primary-button full" type="submit" disabled={saving || careers.length === 0}>
            {saving ? "Saqlanmoqda…" : "Vakansiyani joylash"}
          </button>
          <InlineError text={error} />
        </div>
      </form>
    </Modal>
  );
}

function CandidatesModal({ vacancy, onClose, onInvited }: { vacancy: Vacancy; onClose: () => void; onInvited: () => void }) {
  const [candidates, setCandidates] = useState<VacancyCandidate[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    api
      .getVacancyCandidates(vacancy.id)
      .then((d) => setCandidates(d.candidates))
      .catch(() => setLoadError(LOAD_ERROR));
  }, [vacancy.id]);

  const invite = async (c: VacancyCandidate) => {
    setBusyId(c.id);
    setRowErrors((r) => ({ ...r, [c.id]: "" }));
    try {
      await api.inviteCandidate(c.id, { job_title: vacancy.title });
      setSent((s) => ({ ...s, [c.id]: true }));
    } catch (err) {
      const fallback = err instanceof ApiError && err.status === 402 ? "Oylik taklif limiti tugadi" : "Taklif yuborib bo‘lmadi";
      setRowErrors((r) => ({ ...r, [c.id]: errText(err, fallback) }));
    } finally {
      setBusyId(null);
      onInvited();
    }
  };

  return (
    <Modal title={`Nomzodlar — ${vacancy.title}`} onClose={onClose} width={640}>
      {loadError ? (
        <div style={{ color: "var(--rose)", fontWeight: 600, fontSize: 13 }}>{loadError}</div>
      ) : candidates === null ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Nomzodlar yuklanmoqda…</div>
      ) : candidates.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>Bu kasb uchun mos nomzod topilmadi.</div>
      ) : (
        <div style={{ border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          {candidates.map((c, i) => (
            <div key={c.id} style={{ padding: "12px 14px", borderTop: i === 0 ? 0 : "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ width: 24, color: "var(--muted)", fontWeight: 800, fontSize: 13 }}>{i + 1}</span>
                <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                  <strong style={{ fontSize: 14.5, color: "var(--navy)" }}>{c.name}</strong>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    {c.direction ?? "—"}
                    {c.course ? ` · ${c.course}` : ""}
                  </div>
                </div>
                {c.matchPct === null ? (
                  <span className="vc-chip vc-chip-warn" title={c.missing_must.join(", ") || undefined}>
                    Majburiy ko‘nikma yetishmaydi
                  </span>
                ) : (
                  <span className="vc-chip">Moslik {Math.round(c.matchPct)}%</span>
                )}
                <span className="inv-status inv-status-withdrawn">Tayyorlik {Math.round(c.readiness)}%</span>
                {sent[c.id] ? (
                  <span className="inv-status inv-status-accepted">
                    <Icon name="checkCircle" size={13} /> Taklif yuborildi
                  </span>
                ) : (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busyId === c.id}
                    onClick={() => void invite(c)}
                    style={{ fontSize: 12.5, padding: "7px 11px", whiteSpace: "nowrap" }}
                  >
                    {busyId === c.id ? "…" : "Taklif yuborish"}
                  </button>
                )}
              </div>
              <InlineError text={rowErrors[c.id] || null} />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
