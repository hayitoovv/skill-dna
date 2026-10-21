import { useEffect, useMemo, useState } from "react"
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

const EMPLOYMENT_TONES: Record<Vacancy["employment_type"], string> = {
  full_time: "accent",
  part_time: "warning",
  internship: "success",
}

// Logo tiles: a company always gets the same gradient
const MONOGRAM_GRADIENTS = [
  "linear-gradient(135deg, var(--accent-400), var(--accent-strong))",
  "linear-gradient(135deg, var(--success-400), var(--success-fg))",
  "linear-gradient(135deg, var(--warning-400), var(--warning-fg))",
  "linear-gradient(135deg, var(--danger-400), var(--danger-fg))",
  "linear-gradient(135deg, var(--accent-300), var(--accent))",
]

type Tab = "companies" | "challenges" | "scholarships"
type Sort = "vacancies" | "hires" | "name"

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

const SORTS: { key: Sort; label: string }[] = [
  { key: "vacancies", label: "Vakansiyalar soni" },
  { key: "hires", label: "Ishga olinganlar" },
  { key: "name", label: "Nomi (A–Z)" },
]

const metaText = (c: CompanyCard) => [c.industry, c.region].filter(Boolean).join(" · ") || "—"

function Monogram({ name, large }: { name: string; large?: boolean }) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const letters = name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  return (
    <span
      className={`co-monogram${large ? " large" : ""}`}
      style={{ background: MONOGRAM_GRADIENTS[hash % MONOGRAM_GRADIENTS.length] }}
      aria-hidden="true"
    >
      {letters}
    </span>
  )
}

function readinessTone(pct: number) {
  return pct >= 70 ? "success" : pct >= 40 ? "warning" : "danger"
}

function VacancyItem({ v }: { v: Vacancy }) {
  return (
    <div className="co-vacancy">
      <div className="co-vacancy-head">
        <div style={{ minWidth: 0 }}>
          <strong>{v.title}</strong>
          {v.career && <span className="co-vacancy-career">{v.career}</span>}
        </div>
        <span className="co-openings">{v.openings} o‘rin</span>
      </div>
      <div className="co-chips">
        <span className={`co-chip tone-${EMPLOYMENT_TONES[v.employment_type] ?? "muted"}`}>
          {EMPLOYMENT_LABELS[v.employment_type] ?? v.employment_type}
        </span>
        {v.city && <span className="co-chip">{v.city}</span>}
        {v.salary_note && <span className="co-chip">{v.salary_note}</span>}
      </div>
      {typeof v.readiness === "number" && (
        <div className={`co-readiness tone-${readinessTone(v.readiness)}`}>
          <div className="co-readiness-row">
            <span>Sizning tayyorligingiz</span>
            <strong>{v.readiness}%</strong>
          </div>
          <div className="co-readiness-bar">
            <i style={{ width: `${Math.max(Math.min(v.readiness, 100), 2)}%` }} />
          </div>
          {v.matchPct === null && <small>Majburiy ko‘nikma hali isbotlanmagan</small>}
        </div>
      )}
    </div>
  )
}

function HiresChart({ hires }: { hires: CompanyDetail["hires"] }) {
  const rows = [...hires].sort((a, b) => a.year - b.year)
  const max = Math.max(1, ...rows.map((h) => h.hired))
  return (
    <div className="co-hires" role="list">
      {rows.map((h) => (
        <div
          key={h.year}
          className="co-hires-col"
          role="listitem"
          title={h.platform > 0 ? `${h.hired} talaba · platforma orqali ${h.platform}` : `${h.hired} talaba`}
        >
          <strong>{h.hired}</strong>
          <div className="co-hires-track">
            <i style={{ height: `${Math.max((h.hired / max) * 100, 4)}%` }} />
          </div>
          <span>{h.year}</span>
        </div>
      ))}
    </div>
  )
}

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

  const openVacancies = detail?.vacancies.filter((v) => v.status === "open") ?? []

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal co-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="company-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="modal-close" aria-label="Yopish" onClick={onClose}>
          <Icon name="close" />
        </button>

        {error ? (
          <p style={mutedState}>Ma’lumotni yuklab bo‘lmadi. Server ishlayotganini tekshiring.</p>
        ) : !detail ? (
          <p style={mutedState}>Yuklanmoqda…</p>
        ) : (
          <>
            <header className="co-modal-head">
              <Monogram name={detail.name} large />
              <div style={{ minWidth: 0 }}>
                <h2 id="company-modal-title">
                  {detail.name} {detail.demo && <DemoTag />}
                </h2>
                <span className="co-meta">{metaText(detail)}</span>
                {detail.website && (
                  <a
                    className="co-website"
                    href={detail.website.startsWith("http") ? detail.website : `https://${detail.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {detail.website.replace(/^https?:\/\//, "").replace(/\/$/, "")} <Icon name="external" size={13} />
                  </a>
                )}
              </div>
            </header>

            {detail.about && <p className="co-about-full">{detail.about}</p>}

            <div className="co-modal-stats">
              <div>
                <strong>{openVacancies.length}</strong>
                <span>vakansiya</span>
              </div>
              <div>
                <strong>{openVacancies.reduce((n, v) => n + v.openings, 0)}</strong>
                <span>bo‘sh o‘rin</span>
              </div>
              <div>
                <strong>{detail.hires_last_year.hired}</strong>
                <span>{detail.hires_last_year.year}-yilda olingan</span>
              </div>
            </div>

            <h3 className="co-section-title">
              <Icon name="briefcase" size={16} /> Ochiq vakansiyalar
            </h3>
            {openVacancies.length === 0 ? (
              <p className="co-empty-note">Hozircha ochiq vakansiyalar yo‘q.</p>
            ) : (
              <div className="co-vacancies">
                {openVacancies.map((v) => (
                  <VacancyItem key={v.id} v={v} />
                ))}
              </div>
            )}

            {detail.hires.length > 0 && (
              <>
                <h3 className="co-section-title">
                  <Icon name="users" size={16} /> Universitetingizdan ishga olinganlar
                </h3>
                <HiresChart hires={detail.hires} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function CompanyTile({ c, onOpen, delay }: { c: CompanyCard; onOpen: () => void; delay: number }) {
  const hasOpen = c.open_vacancies > 0
  return (
    <button className={`card co-card${hasOpen ? "" : " is-quiet"}`} onClick={onOpen} style={{ animationDelay: `${delay}ms` }}>
      <div className="co-card-top">
        <Monogram name={c.name} />
        <div className="co-card-title">
          <strong className="co-card-name">{c.name}</strong>
          <span className="co-meta" title={metaText(c)}>
            {metaText(c)}
          </span>
          <div className="co-card-tags">
            <span className={`co-status${hasOpen ? " open" : ""}`}>
              <i /> {hasOpen ? "Ishga olmoqda" : "Vakansiya yo‘q"}
            </span>
            {c.demo && <DemoTag />}
          </div>
        </div>
      </div>

      {c.about && <p className="co-about">{c.about}</p>}

      <div className="co-metrics">
        <div>
          <strong>{c.open_vacancies}</strong>
          <span>vakansiya</span>
        </div>
        <div>
          <strong>{c.openings}</strong>
          <span>bo‘sh o‘rin</span>
        </div>
        <div title={`${c.hires_last_year.year}-yilda universitetingizdan ishga olingan`}>
          <strong>{c.hires_last_year.hired || "—"}</strong>
          <span>ishga olingan</span>
        </div>
      </div>

      <div className="co-card-foot">
        <span>Batafsil ko‘rish</span>
        <Icon name="arrow" size={16} />
      </div>
    </button>
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
  const [query, setQuery] = useState("")
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [sort, setSort] = useState<Sort>("vacancies")
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

  const totals = useMemo(() => {
    const list = companies ?? []
    return {
      vacancies: list.reduce((n, c) => n + c.open_vacancies, 0),
      openings: list.reduce((n, c) => n + c.openings, 0),
      hired: list.reduce((n, c) => n + c.hires_last_year.hired, 0),
      year: list[0]?.hires_last_year.year ?? new Date().getFullYear() - 1,
    }
  }, [companies])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (companies ?? []).filter(
      (c) =>
        (!onlyOpen || c.open_vacancies > 0) &&
        (!q || [c.name, c.industry, c.region].some((t) => t?.toLowerCase().includes(q))),
    )
    return list.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : sort === "hires"
          ? b.hires_last_year.hired - a.hires_last_year.hired
          : b.openings - a.openings || b.open_vacancies - a.open_vacancies,
    )
  }, [companies, query, onlyOpen, sort])

  return (
    <div className="page co-page">
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
      ) : error ? (
        <section className="card" style={mutedState}>
          Ma’lumotni yuklab bo‘lmadi. Server ishlayotganini tekshiring.
        </section>
      ) : !companies ? (
        <section className="card" style={mutedState}>
          Yuklanmoqda…
        </section>
      ) : (
        <>
          <section className="card co-hero">
            <div className="co-hero-text">
              <span className="co-hero-label">
                <Icon name="target" size={14} /> {careerFilter ? `Kasb: ${careerFilter.name}` : "Bandlik imkoniyatlari"}
              </span>
              <h2>{totals.openings} ta bo‘sh o‘rin</h2>
              <p>
                {companies.length} ta korxonada, {totals.vacancies} ta ochiq vakansiya
              </p>
              {careerFilter && onClearFilter && (
                <button className="co-hero-clear" onClick={onClearFilter}>
                  <Icon name="close" size={13} /> Filtrni olib tashlash
                </button>
              )}
            </div>
            <div className="co-hero-stats">
              <div>
                <Icon name="building" size={18} />
                <strong>{companies.length}</strong>
                <span>korxona</span>
              </div>
              <div>
                <Icon name="briefcase" size={18} />
                <strong>{totals.vacancies}</strong>
                <span>vakansiya</span>
              </div>
              <div>
                <Icon name="userCheck" size={18} />
                <strong>{totals.hired}</strong>
                <span>{totals.year}-yilda olingan</span>
              </div>
            </div>
          </section>

          {companies.length === 0 ? (
            <section className="card" style={{ ...mutedState, marginTop: "18px" }}>
              Hozircha korxonalar yo‘q
            </section>
          ) : (
            <>
              <div className="co-toolbar">
                <label className="co-search">
                  <Icon name="search" size={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Korxona, soha yoki hudud…"
                    aria-label="Korxonalarni qidirish"
                  />
                </label>
                <div className="co-toolbar-right">
                  <button className={`co-toggle${onlyOpen ? " active" : ""}`} onClick={() => setOnlyOpen((v) => !v)} aria-pressed={onlyOpen}>
                    <i /> Faqat vakansiyasi borlar
                  </button>
                  <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Saralash">
                    {SORTS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {visible.length === 0 ? (
                <section className="card" style={mutedState}>
                  Shartlarga mos korxona topilmadi.
                </section>
              ) : (
                <div className="co-grid">
                  {visible.map((c, i) => (
                    <CompanyTile key={c.id} c={c} onOpen={() => setOpenId(c.id)} delay={Math.min(i, 8) * 40} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {openId && <CompanyModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}
