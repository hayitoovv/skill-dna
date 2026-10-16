import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { Icon } from "../common/Icons";
import UniversityScholarships from "./UniversityScholarships";
import { FEATURES } from "../../config/features";
import { api, type CompanyCard, type CompanyDetail, type EmploymentType, type HiringYear } from "../../services/api";

const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  full_time: "To‘liq stavka",
  part_time: "Yarim stavka",
  internship: "Amaliyot (stajyor)",
};

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
const labelStyle: CSSProperties = { display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" };
const inputStyle: CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: "8px",
  border: "1px solid var(--border)",
  fontSize: "13.5px",
  boxSizing: "border-box",
};
const mutedText: CSSProperties = { margin: 0, fontSize: "13.5px", color: "var(--muted)" };
const th: CSSProperties = { padding: "8px 10px" };
const td: CSSProperties = { padding: "10px" };
const theadRow: CSSProperties = { textAlign: "left", color: "var(--muted)", fontSize: "12px", textTransform: "uppercase" };
const sectionTitle: CSSProperties = { margin: "0 0 10px", fontSize: "14.5px", fontWeight: 800, color: "var(--navy)" };

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

function ModalHeader({ id, icon, title, onClose }: { id: string; icon: "building" | "briefcase"; title: string; onClose: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "12px" }}>
      <h3 id={id} style={{ margin: 0, fontSize: "18px", color: "var(--navy)", display: "flex", alignItems: "center", gap: "8px" }}>
        <Icon name={icon} size={18} /> {title}
      </h3>
      <button onClick={onClose} aria-label="Yopish" style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--subtle)" }}>
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}

function AddCompanyModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", industry: "", region: "", website: "", about: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await api.createCompany({
        name: form.name.trim(),
        industry: form.industry.trim() || null,
        region: form.region.trim() || null,
        website: form.website.trim() || null,
        about: form.about.trim() || null,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Korxonani saqlab bo‘lmadi.");
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="add-company-title" style={overlayStyle} onClick={onClose}>
      <div className="card" style={{ ...modalStyle, maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
        <ModalHeader id="add-company-title" icon="building" title="Yangi korxona qo‘shish" onClose={onClose} />
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={labelStyle}>Korxona nomi:</label>
            <input type="text" required placeholder="Masalan: EPAM Systems" value={form.name} onChange={set("name")} style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Soha:</label>
              <input type="text" placeholder="IT xizmatlari" value={form.industry} onChange={set("industry")} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Hudud:</label>
              <input type="text" placeholder="Toshkent" value={form.region} onChange={set("region")} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Veb-sayt:</label>
            <input type="text" placeholder="https://..." value={form.website} onChange={set("website")} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Korxona haqida:</label>
            <textarea rows={3} value={form.about} onChange={set("about")} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </div>
          {error && <p style={{ margin: 0, fontSize: "13px", color: "var(--danger, #b42318)" }}>{error}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
            <button type="button" className="secondary-button" onClick={onClose}>
              Bekor qilish
            </button>
            <button type="submit" className="primary-button" disabled={saving} style={{ padding: "8px 18px", borderRadius: "8px" }}>
              {saving ? "Saqlanmoqda…" : "Korxonani saqlash"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CompanyDetailsModal({ companyId, onClose, onStatSaved }: { companyId: string; onClose: () => void; onStatSaved: () => void }) {
  const lastYear = new Date().getFullYear() - 1;
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [error, setError] = useState(false);
  const [year, setYear] = useState(String(lastYear));
  const [hired, setHired] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [statMsg, setStatMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api
      .getCompany(companyId)
      .then((d) => {
        setDetail(d);
        setError(false);
      })
      .catch(() => setError(true));
  }, [companyId]);

  const submitStat = async (e: FormEvent) => {
    e.preventDefault();
    const y = Number(year);
    const h = Number(hired);
    if (!Number.isInteger(y) || !Number.isInteger(h) || h < 0) return;
    setSaving(true);
    setStatMsg(null);
    try {
      const { hires }: { hires: HiringYear[] } = await api.recordHiringStat(companyId, { year: y, hired_count: h, note: note.trim() || null });
      setDetail((d) => (d ? { ...d, hires } : d));
      setHired("");
      setNote("");
      setStatMsg({ ok: true, text: "Statistika saqlandi." });
      onStatSaved();
    } catch (err) {
      setStatMsg({ ok: false, text: err instanceof Error && err.message ? err.message : "Statistikani saqlab bo‘lmadi." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="company-detail-title" style={overlayStyle} onClick={onClose}>
      <div className="card" style={{ ...modalStyle, maxWidth: "720px" }} onClick={(e) => e.stopPropagation()}>
        <ModalHeader id="company-detail-title" icon="briefcase" title={detail?.name ?? "Korxona"} onClose={onClose} />

        {error ? (
          <p style={mutedText}>{LOAD_ERROR}</p>
        ) : !detail ? (
          <p style={mutedText}>Yuklanmoqda…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            <div>
              <p style={{ ...mutedText, fontSize: "13px" }}>
                {[detail.industry, detail.region].filter(Boolean).join(" · ") || "—"}
                {detail.demo && <DemoPill />}
              </p>
              {detail.website && (
                <a href={detail.website} target="_blank" rel="noreferrer" style={{ fontSize: "13px", color: "var(--royal)", fontWeight: 600 }}>
                  {detail.website}
                </a>
              )}
              {detail.about && <p style={{ margin: "8px 0 0", fontSize: "13.5px", color: "var(--text-2)" }}>{detail.about}</p>}
            </div>

            <div>
              <h4 style={sectionTitle}>Ochiq vakansiyalar</h4>
              {detail.vacancies.length === 0 ? (
                <p style={mutedText}>Hozircha ochiq vakansiyalar yo‘q.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                    <thead>
                      <tr style={theadRow}>
                        <th style={th}>Lavozim</th>
                        <th style={th}>Kasb</th>
                        <th style={{ ...th, textAlign: "right" }}>O‘rinlar</th>
                        <th style={th}>Bandlik turi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.vacancies.map((v) => (
                        <tr key={v.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                          <td style={{ ...td, fontWeight: 600, color: "var(--navy)" }}>{v.title}</td>
                          <td style={{ ...td, color: "var(--muted)" }}>{v.career ?? "—"}</td>
                          <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "var(--navy)" }}>{v.openings}</td>
                          <td style={{ ...td, color: "var(--text-2)" }}>{EMPLOYMENT_LABEL[v.employment_type] ?? v.employment_type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h4 style={sectionTitle}>Bitiruvchilarimizni ishga olish</h4>
              {detail.hires.length === 0 ? (
                <p style={mutedText}>Hozircha statistika kiritilmagan.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                    <thead>
                      <tr style={theadRow}>
                        <th style={th}>Yil</th>
                        <th style={{ ...th, textAlign: "right" }}>Ishga olingan</th>
                        <th style={th}>Manba</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...detail.hires]
                        .sort((a, b) => b.year - a.year)
                        .map((h) => (
                          <tr key={h.year} style={{ borderTop: "1px solid var(--border-soft)" }}>
                            <td style={{ ...td, fontWeight: 600, color: "var(--navy)" }}>{h.year}</td>
                            <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "var(--navy)" }}>{h.hired}</td>
                            <td style={{ ...td, color: "var(--muted)" }}>
                              {h.manual != null ? "qo‘lda kiritilgan" : "platforma"}
                              {h.manual != null && h.platform > 0 && <span> · platforma orqali: {h.platform}</span>}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <form
              onSubmit={submitStat}
              style={{ borderTop: "1px solid var(--border-soft)", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <h4 style={{ ...sectionTitle, margin: 0 }}>Statistika kiritish</h4>
              <div style={{ display: "grid", gridTemplateColumns: "110px 140px 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Yil:</label>
                  <input type="number" required min={2000} max={lastYear + 1} value={year} onChange={(e) => setYear(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Ishga olinganlar:</label>
                  <input type="number" required min={0} value={hired} onChange={(e) => setHired(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Izoh:</label>
                  <input type="text" placeholder="Ixtiyoriy" value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "12px" }}>
                {statMsg && (
                  <span style={{ fontSize: "13px", color: statMsg.ok ? "var(--muted)" : "var(--danger, #b42318)" }}>{statMsg.text}</span>
                )}
                <button type="submit" className="primary-button" disabled={saving} style={{ padding: "8px 18px", borderRadius: "8px" }}>
                  {saving ? "Saqlanmoqda…" : "Saqlash"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

/** University staff view of partner companies, their vacancies and hiring of our graduates. */
export default function UniversityCompanies() {
  const [companies, setCompanies] = useState<CompanyCard[] | null>(null);
  const [error, setError] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .getCompanies()
      .then((c) => {
        setCompanies(c);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--navy)", margin: 0 }}>Hamkor korxonalar</h2>
          <p style={{ margin: "2px 0 0", fontSize: "13.5px", color: "var(--muted)" }}>
            Korxonalar, ochiq vakansiyalar va universitetimiz bitiruvchilarini ishga olish statistikasi.
          </p>
        </div>
        <button className="primary-button" onClick={() => setShowAdd(true)} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <Icon name="plus" size={16} /> Korxona qo‘shish
        </button>
      </div>

      <section className="card" style={{ padding: "22px" }}>
        {error ? (
          <p style={mutedText}>{LOAD_ERROR}</p>
        ) : !companies ? (
          <p style={mutedText}>Yuklanmoqda…</p>
        ) : companies.length === 0 ? (
          <p style={mutedText}>Hozircha korxonalar qo‘shilmagan.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={theadRow}>
                  <th style={th}>Korxona</th>
                  <th style={th}>Soha</th>
                  <th style={th}>Hudud</th>
                  <th style={{ ...th, textAlign: "right" }}>Vakansiyalar / o‘rinlar</th>
                  <th style={{ ...th, textAlign: "right" }}>Ishga olish</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setOpenId(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenId(c.id);
                      }
                    }}
                    tabIndex={0}
                    style={{ borderTop: "1px solid var(--border-soft)", cursor: "pointer" }}
                  >
                    <td style={{ ...td, fontWeight: 600, color: "var(--navy)" }}>
                      {c.name}
                      {c.demo && <DemoPill />}
                    </td>
                    <td style={{ ...td, color: "var(--muted)" }}>{c.industry ?? "—"}</td>
                    <td style={{ ...td, color: "var(--muted)" }}>{c.region ?? "—"}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "var(--navy)" }}>
                      {c.open_vacancies} / {c.openings}
                    </td>
                    <td style={{ ...td, textAlign: "right", color: "var(--text-2)", whiteSpace: "nowrap" }}>
                      {c.hires_last_year.year}-yilda ishga olingan: <strong style={{ color: "var(--navy)" }}>{c.hires_last_year.hired}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {FEATURES.sponsorships && <UniversityScholarships />}

      {showAdd && (
        <AddCompanyModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}
      {openId && <CompanyDetailsModal companyId={openId} onClose={() => setOpenId(null)} onStatSaved={load} />}
    </div>
  );
}
