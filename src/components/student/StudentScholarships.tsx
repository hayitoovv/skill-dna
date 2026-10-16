import { useEffect, useState } from "react"
import { Icon } from "../common/Icons"
import { api, type ScholarshipCard } from "../../services/api"
import DemoTag, {
  StatusChip,
  formatDate,
  isDemoText,
  mutedState,
} from "./DemoTag"

const STATUS: Record<ScholarshipCard["status"], {
  label: string
  tone: "success" | "muted" | "accent"
}> = {
  open: { label: "Qabul ochiq", tone: "accent" },
  awarded: { label: "Berildi", tone: "success" },
  closed: { label: "Yopilgan", tone: "muted" },
}

function Standing({ s }: { s: ScholarshipCard }) {
  if (!s.me) return null
  if (s.me.awarded)
    return (
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: "var(--success-fg)",
          fontWeight: 700,
          fontSize: "13px",
        }}
      >
        <Icon name="award" size={15} /> Sizga berildi
      </span>
    )
  if (s.me.within_slots)
    return (
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: "var(--accent)",
          fontWeight: 600,
          fontSize: "13px",
        }}
      >
        <Icon name="target" size={15} /> Siz hozir {s.me.rank}-o‘rindasiz —
        o‘rinlar ichidasiz
      </span>
    )
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        color: "var(--muted)",
        fontSize: "13px",
      }}
    >
      <Icon name="target" size={15} /> Siz {s.me.rank}-o‘rindasiz. Stipendiya
      top-{s.slots} ga beriladi.
    </span>
  )
}

export default function StudentScholarships() {
  const [items, setItems] = useState<ScholarshipCard[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    api
      .getScholarships()
      .then(setItems)
      .catch(() => setError(true))
  }, [])

  if (error)
    return (
      <section className="card" style={mutedState}>
        Ma’lumotni yuklab bo‘lmadi. Server ishlayotganini tekshiring.
      </section>
    )
  if (!items)
    return (
      <section className="card" style={mutedState}>
        Yuklanmoqda…
      </section>
    )
  if (items.length === 0)
    return (
      <section className="card" style={mutedState}>
        Hozircha stipendiyalar yo‘q
      </section>
    )

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "16px",
      }}
    >
      {items.map((s) => {
        const st = STATUS[s.status] ?? STATUS.closed
        return (
          <section
            key={s.id}
            className="card"
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <p className="card-kicker" style={{ margin: 0 }}>
                {s.company ?? "—"}
              </p>
              <div
                style={{ display: "flex", gap: "6px", alignItems: "center" }}
              >
                {isDemoText(s.description) && <DemoTag />}
                <StatusChip label={st.label} tone={st.tone} />
              </div>
            </div>
            <strong style={{ color: "var(--navy)", fontSize: "15.5px" }}>
              {s.title}
            </strong>
            {s.amount_note && (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  color: "var(--accent)",
                  fontWeight: 600,
                }}
              >
                <Icon name="award" size={15} /> {s.amount_note}
              </span>
            )}
            {s.description && (
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "var(--text-3)",
                  lineHeight: 1.5,
                }}
              >
                {s.description}
              </p>
            )}
            <div
              style={{
                display: "grid",
                gap: "6px",
                fontSize: "13px",
                color: "var(--text-2)",
              }}
            >
              <span
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <Icon name="users" size={15} /> {s.slots} o‘rin ·{" "}
                {s.direction ?? "Butun universitet"}
              </span>
              {s.deadline && (
                <span
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <Icon name="clock" size={15} /> Tugash:{" "}
                  {formatDate(s.deadline)}
                </span>
              )}
              <Standing s={s} />
            </div>
          </section>
        )
      })}
    </div>
  )
}
