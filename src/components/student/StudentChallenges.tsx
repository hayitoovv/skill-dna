import { useEffect, useState } from "react"
import { Icon } from "../common/Icons"
import {
  api,
  type ChallengeCard,
  type ChallengeDetail,
} from "../../services/api"
import DemoTag, {
  StatusChip,
  formatDate,
  isDemoText,
  mutedState,
} from "./DemoTag"

function ChallengeModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<ChallengeDetail | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    setDetail(null)
    setError(false)
    api
      .getChallenge(id)
      .then(setDetail)
      .catch(() => setError(true))
  }, [id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="challenge-modal-title"
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
            <div style={{ paddingRight: "36px", marginBottom: "14px" }}>
              <p className="card-kicker" style={{ margin: "0 0 4px" }}>
                {detail.company ?? "—"}
              </p>
              <h2
                id="challenge-modal-title"
                style={{
                  fontSize: "20px",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                {detail.title}{" "}
                {isDemoText(detail.description, detail.prize_note) && (
                  <DemoTag />
                )}
                {detail.status === "closed" && (
                  <StatusChip label="Yakunlangan" tone="muted" />
                )}
              </h2>
              <span style={{ fontSize: "13px", color: "var(--muted)" }}>
                {formatDate(detail.starts_at)} — {formatDate(detail.ends_at)}
                {detail.prize_note && ` · ${detail.prize_note}`}
              </span>
            </div>

            {detail.description && (
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: "14px",
                  color: "var(--text-2)",
                  lineHeight: 1.55,
                }}
              >
                {detail.description}
              </p>
            )}

            <h3
              style={{
                fontSize: "15px",
                margin: "22px 0 6px",
                color: "var(--navy)",
              }}
            >
              Topshiriqlar ({detail.tasks.length})
            </h3>
            <p
              style={{
                margin: "0 0 10px",
                fontSize: "12.5px",
                color: "var(--muted)",
              }}
            >
              Topshiriqlarni “Topshiriqlar” bo‘limidan bajaring — natija
              avtomatik hisoblanadi.
            </p>
            {detail.tasks.length === 0 ? (
              <p
                style={{ margin: 0, fontSize: "13.5px", color: "var(--muted)" }}
              >
                Topshiriqlar yo‘q.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {detail.tasks.map((t) => (
                  <div
                    key={t.id}
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
                      <strong
                        style={{
                          color: "var(--navy)",
                          fontSize: "14.5px",
                          minWidth: 0,
                        }}
                      >
                        {t.title}
                      </strong>
                      <span
                        className="level-badge"
                        style={{ whiteSpace: "nowrap" }}
                      >
                        {t.layer}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "12.5px",
                        color: "var(--text-3)",
                        marginTop: "6px",
                        display: "flex",
                        gap: "8px",
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <span>{t.skill}</span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        · <Icon name="clock" size={13} /> ≈ {t.duration_minutes}{" "}
                        daqiqa
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h3
              style={{
                fontSize: "15px",
                margin: "22px 0 8px",
                color: "var(--navy)",
              }}
            >
              Reyting (top-10)
            </h3>
            {detail.leaderboard.length === 0 ? (
              <p
                style={{ margin: 0, fontSize: "13.5px", color: "var(--muted)" }}
              >
                Hozircha ishtirokchilar yo‘q.
              </p>
            ) : (
              <div>
                {detail.leaderboard.map((row, i) => (
                  <div
                    key={`${row.rank}-${i}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "8px 10px",
                      fontSize: "13.5px",
                      borderRadius: "8px",
                      background: row.is_me ? "var(--accent-soft)" : undefined,
                      borderTop:
                        i === 0 || row.is_me
                          ? undefined
                          : "1px solid var(--border-soft)",
                    }}
                  >
                    <span
                      style={{
                        width: "28px",
                        fontWeight: 700,
                        color: "var(--muted)",
                      }}
                    >
                      {row.rank}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        color: "var(--navy)",
                        fontWeight: row.is_me ? 700 : 500,
                      }}
                    >
                      {row.name}
                      {row.is_me && (
                        <span style={{ color: "var(--accent)" }}> · Siz</span>
                      )}
                    </span>
                    <strong style={{ color: "var(--navy)" }}>
                      {row.score} ball
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function StudentChallenges() {
  const [items, setItems] = useState<ChallengeCard[] | null>(null)
  const [error, setError] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    api
      .getChallenges()
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
        Hozircha tanlovlar yo‘q
      </section>
    )

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
        }}
      >
        {items.map((c) => (
          <button
            key={c.id}
            className="card"
            onClick={() => setOpenId(c.id)}
            style={{
              textAlign: "left",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              font: "inherit",
              width: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                width: "100%",
              }}
            >
              <p className="card-kicker" style={{ margin: 0 }}>
                {c.company ?? "—"}
              </p>
              <div
                style={{ display: "flex", gap: "6px", alignItems: "center" }}
              >
                {isDemoText(c.description, c.prize_note) && <DemoTag />}
                {c.status === "closed" && (
                  <StatusChip label="Yakunlangan" tone="muted" />
                )}
              </div>
            </div>
            <strong style={{ color: "var(--navy)", fontSize: "15.5px" }}>
              {c.title}
            </strong>
            {c.prize_note && (
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
                <Icon name="trophy" size={15} /> {c.prize_note}
              </span>
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
                <Icon name="layers" size={15} /> {c.task_count} ta topshiriq ·{" "}
                {c.participants} ishtirokchi
              </span>
              <span
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <Icon name="clock" size={15} /> Tugash: {formatDate(c.ends_at)}
              </span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: c.me ? "var(--navy)" : "var(--muted)",
                  fontWeight: c.me ? 600 : 400,
                }}
              >
                <Icon name="target" size={15} />
                {c.me
                  ? `Sizning o‘rningiz: ${c.me.rank}/${c.me.total} · ${c.me.score} ball`
                  : "Siz hali qatnashmagansiz"}
              </span>
            </div>
          </button>
        ))}
      </div>
      {openId && <ChallengeModal id={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}
