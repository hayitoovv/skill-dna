import { useEffect, useState } from "react"
import { FEATURES } from "../../config/features"
import { Icon } from "../common/Icons"
import {
  api,
  type CompanyCard,
  type CompanyDetail,
  type Vacancy,
} from "../../services/api"
import DemoTag, { mutedState } from "./DemoTag"
import StudentChallenges from "./StudentChallenges"
import StudentScholarships from "./StudentScholarships"

const EMPLOYMENT_LABELS: Record<Vacancy["employment_type"], string> = {
  full_time: "To‘liq stavka",
  part_time: "Yarim stavka",
  internship: "Amaliyot (stajyor)",
}

type Tab = "companies" | "challenges" | "scholarships"

const ALL_TABS: { key: Tab; label: string; subtitle: string }[] = [
  {
    key: "companies",
    label: "Korxonalar",
    subtitle:
      "Qaysi korxonalarda vakansiya borligi va o‘tgan yili universitetingizdan nechta talabani ishga olgani.",
  },
  {
    key: "challenges",
    label: "Tanlovlar",
    subtitle:
      "Korxonalar homiyligidagi topshiriqlar to‘plami. Natija platforma baholashi bo‘yicha hisoblanadi.",
  },
  {
    key: "scholarships",
    label: "Stipendiyalar",
    subtitle:
      "Korxonalar universitetingiz reytingidagi eng yaxshi talabalarga beradigan stipendiyalar.",
  },
]

const TABS = FEATURES.sponsorships ? ALL_TABS : ALL_TABS.filter((t) => t.key === "companies")

const hiresText = (c: CompanyCard) =>
  c.hires_last_year.hired > 0
    ? `${c.hires_last_year.year}-yilda universitetingizdan ${c.hires_last_year.hired} talaba ishga olingan`
    : `${c.hires_last_year.year}-yil bo‘yicha ma’lumot yo‘q`

function CompanyModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<CompanyDetail | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    setDetail(null)
    setError(false)
    api
      .getCompany(id)
      .then(setDetail)
      .catch(() => setError(true))
  }, [id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const openVacancies =
    detail?.vacancies.filter((v) => v.status === "open") ?? []

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="company-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          maxWidth: "640px",
          width: "95%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <button className="modal-close" aria-label="Yopish" onClick={onClose}>
          <Icon name="close" />
        </button>

        {error ? (
          <p style={mutedState}>
            Ma’lumotni yuklab bo‘lmadi. Server ishlayotganini tekshiring.
          </p>
        ) : !detail ? (
          <p style={mutedState}>Yuklanmoqda…</p>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "16px",
                paddingRight: "36px",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name="building" size={22} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h2
                  id="company-modal-title"
                  style={{
                    fontSize: "20px",
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  {detail.name} {detail.demo && <DemoTag />}
                </h2>
                <span style={{ fontSize: "13px", color: "var(--muted)" }}>
                  {[detail.industry, detail.region]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
              </div>
            </div>

            {detail.about && (
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: "14px",
                  color: "var(--text-2)",
                  lineHeight: 1.55,
                }}
              >
                {detail.about}
              </p>
            )}
            {detail.website && (
              <a
                className="text-button"
                href={
                  detail.website.startsWith("http")
                    ? detail.website
                    : `https://${detail.website}`
                }
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13.5px",
                }}
              >
                {detail.website.replace(/^https?:\/\//, "")}{" "}
                <Icon name="external" size={14} />
              </a>
            )}

            <h3
              style={{
                fontSize: "15px",
                margin: "22px 0 10px",
                color: "var(--navy)",
              }}
            >
              Ochiq vakansiyalar ({openVacancies.length})
            </h3>
            {openVacancies.length === 0 ? (
              <p
                style={{ margin: 0, fontSize: "13.5px", color: "var(--muted)" }}
              >
                Hozircha ochiq vakansiyalar yo‘q.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {openVacancies.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      border: "1px solid var(--border-soft)",
                      borderRadius: "12px",
                      padding: "12px 14px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "10px",
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <strong
                          style={{ color: "var(--navy)", fontSize: "14.5px" }}
                        >
                          {v.title}
                        </strong>
                        {v.career && (
                          <div
                            style={{
                              fontSize: "12.5px",
                              color: "var(--muted)",
                            }}
                          >
                            {v.career}
                          </div>
                        )}
                      </div>
                      <span
                        className="level-badge"
                        style={{ whiteSpace: "nowrap" }}
                      >
                        {v.openings} o‘rin
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "12.5px",
                        color: "var(--text-3)",
                        marginTop: "6px",
                      }}
                    >
                      {[
                        EMPLOYMENT_LABELS[v.employment_type] ??
                          v.employment_type,
                        v.city,
                        v.salary_note,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {typeof v.readiness === "number" && (
                      <div style={{ marginTop: "8px", fontSize: "13px" }}>
                        <span
                          style={{ color: "var(--accent)", fontWeight: 700 }}
                        >
                          Sizning tayyorligingiz {v.readiness}%
                        </span>
                        {v.matchPct === null && (
                          <span
                            style={{ color: "var(--muted)", marginLeft: "8px" }}
                          >
                            · Majburiy ko‘nikma hali isbotlanmagan
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {detail.hires.length > 0 && (
              <>
                <h3
                  style={{
                    fontSize: "15px",
                    margin: "22px 0 8px",
                    color: "var(--navy)",
                  }}
                >
                  Yillar bo‘yicha ishga olinganlar
                </h3>
                <div>
                  {detail.hires.map((h, i) => (
                    <div
                      key={h.year}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                        padding: "8px 0",
                        fontSize: "13.5px",
                        borderTop:
                          i === 0 ? undefined : "1px solid var(--border-soft)",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>
                        {h.year}-yil
                      </span>
                      <span style={{ color: "var(--navy)" }}>
                        <strong>{h.hired}</strong> talaba
                        {h.platform > 0 && (
                          <span style={{ color: "var(--muted)" }}>
                            {" "}
                            · platforma orqali {h.platform}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function StudentCompanies({
  careerFilter,
  onClearFilter,
}: {
  careerFilter?: { id: string; name: string } | null
  onClearFilter?: () => void
}) {
  const [companies, setCompanies] = useState<CompanyCard[] | null>(null)
  const [error, setError] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("companies")
  const careerId = careerFilter?.id

  useEffect(() => {
    if (careerId) setTab("companies")
  }, [careerId])

  useEffect(() => {
    setCompanies(null)
    setError(false)
    api
      .getCompanies(careerId)
      .then(setCompanies)
      .catch(() => setError(true))
  }, [careerId])

  const activeTab = careerFilter ? "companies" : tab
  const current = TABS.find((t) => t.key === activeTab) ?? TABS[0]

  return (
    <div className="page">
      <section className="welcome-row inner-intro">
        <div>
          <p className="eyebrow">KORXONALAR</p>
          <h1>Korxonalar</h1>
          <p className="subtitle">{current.subtitle}</p>
        </div>
      </section>

      {TABS.length > 1 && (
      <div className="filter-row">
        <div className="filter-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={activeTab === t.key ? "active" : ""}
              onClick={() => {
                if (careerFilter && t.key !== "companies") onClearFilter?.()
                setTab(t.key)
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      )}

      {activeTab === "challenges" ? (
        <StudentChallenges />
      ) : activeTab === "scholarships" ? (
        <StudentScholarships />
      ) : (
        <>
          {careerFilter && (
            <p
              style={{
                margin: "0 0 14px",
                fontSize: "13.5px",
                color: "var(--text-3)",
                display: "flex",
                gap: "10px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span>
                Kasb bo‘yicha:{" "}
                <strong style={{ color: "var(--navy)" }}>
                  {careerFilter.name}
                </strong>
              </span>
              {onClearFilter && (
                <button className="text-button" onClick={onClearFilter}>
                  Filtrni olib tashlash
                </button>
              )}
            </p>
          )}

          {error ? (
            <section className="card" style={mutedState}>
              Ma’lumotni yuklab bo‘lmadi. Server ishlayotganini tekshiring.
            </section>
          ) : !companies ? (
            <section className="card" style={mutedState}>
              Yuklanmoqda…
            </section>
          ) : companies.length === 0 ? (
            <section className="card" style={mutedState}>
              Hozircha korxonalar yo‘q
            </section>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "16px",
              }}
            >
              {companies.map((c) => (
                <button
                  key={c.id}
                  className="card"
                  onClick={() => setOpenId(c.id)}
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    font: "inherit",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "12px",
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="building" size={20} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <strong
                          style={{ color: "var(--navy)", fontSize: "15.5px" }}
                        >
                          {c.name}
                        </strong>
                        {c.demo && <DemoTag />}
                      </div>
                      <div
                        style={{ fontSize: "12.5px", color: "var(--muted)" }}
                      >
                        {[c.industry, c.region].filter(Boolean).join(" · ") ||
                          "—"}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gap: "6px",
                      fontSize: "13px",
                      color: "var(--text-2)",
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <Icon name="briefcase" size={15} /> {c.open_vacancies} ta
                      vakansiya · {c.openings} o‘rin
                    </span>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        color:
                          c.hires_last_year.hired > 0
                            ? "var(--text-2)"
                            : "var(--muted)",
                      }}
                    >
                      <Icon name="users" size={15} /> {hiresText(c)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {openId && <CompanyModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}
