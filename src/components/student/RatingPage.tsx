import { useEffect, useState } from "react";
import { Icon } from "../common/Icons";
import { api, type RatingBoard, type RatingScope, type RatingSummary, type RatingPlace } from "../../services/api";

const SCOPES: { key: RatingScope; label: string }[] = [
  { key: "university", label: "Universitet" },
  { key: "direction", label: "Yo‘nalish" },
  { key: "group", label: "Guruh" },
];

const placeText = (p: RatingPlace) => (p ? `${p.rank}-o‘rin / ${p.total}` : "—");

/** One line on the dashboard: the student's place in the university, opening the rating page. */
export function RatingTeaser({ onOpen, refreshKey }: { onOpen: () => void; refreshKey?: unknown }) {
  const [me, setMe] = useState<RatingSummary | null>(null);
  useEffect(() => {
    api.getMyRating().then(setMe).catch(() => setMe(null));
  }, [refreshKey]);
  if (!me?.university) return null;
  return (
    <button className="secondary-button" onClick={onOpen} title="Reytingni ko‘rish">
      <Icon name="trophy" size={16} /> Universitetda {placeText(me.university)}
    </button>
  );
}

export default function RatingPage({ onOpenSettings, refreshKey }: { onOpenSettings: () => void; refreshKey?: unknown }) {
  const [scope, setScope] = useState<RatingScope>("university");
  const [me, setMe] = useState<RatingSummary | null>(null);
  const [board, setBoard] = useState<RatingBoard | null>(null);
  const [isPublic, setIsPublic] = useState<boolean | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.getMyRating().then(setMe).catch(() => setError(true));
    api
      .getConsents()
      .then((rows) => setIsPublic(!!rows.find((c) => c.type === "rating_public")?.granted))
      .catch(() => setIsPublic(null));
  }, [refreshKey]);

  useEffect(() => {
    setBoard(null);
    api.getRating(scope).then(setBoard).catch(() => setError(true));
  }, [scope, refreshKey]);

  const rows = board ? [...board.top, ...(board.me ? [board.me] : [])] : [];

  return (
    <div className="page">
      <section className="welcome-row inner-intro">
        <div>
          <p className="eyebrow">REYTING</p>
          <h1>Reyting</h1>
          <p className="subtitle">
            Ball yo‘nalishingizdagi barcha ko‘nikmalar bo‘yicha hisoblanadi. Har bir bajarilgan topshiriq o‘rningizni yangilaydi.
          </p>
        </div>
      </section>

      {error && !me ? (
        <section className="card" style={{ textAlign: "center", padding: "36px 24px", color: "var(--muted)", fontSize: "14px" }}>
          Reytingni yuklab bo‘lmadi. Server ishlayotganini tekshiring.
        </section>
      ) : (
        <>
          <section className="employer-stats-row">
            {[
              { label: "Reyting bali", value: me ? `${me.score} / 100` : "—", icon: "chart" as const },
              { label: "Universitetda", value: me ? placeText(me.university) : "—", icon: "university" as const },
              { label: me?.direction_name ? `Yo‘nalishda · ${me.direction_name}` : "Yo‘nalishda", value: me ? placeText(me.direction) : "—", icon: "layers" as const },
              { label: me?.group_id ? `Guruhda · ${me.group_id}` : "Guruhda", value: me ? placeText(me.group) : "—", icon: "users" as const },
            ].map((s) => (
              <div className="employer-stat-pill" key={s.label}>
                <div
                  style={{ width: "42px", height: "42px", borderRadius: "12px", background: "var(--accent-soft)", color: "var(--accent)", display: "grid", placeItems: "center" }}
                >
                  <Icon name={s.icon} size={20} />
                </div>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>{s.label}</div>
                  <strong style={{ fontSize: "19px", color: "var(--navy)" }}>{s.value}</strong>
                </div>
              </div>
            ))}
          </section>

          <div className="filter-row">
            <div className="filter-tabs">
              {SCOPES.map((s) => (
                <button key={s.key} className={scope === s.key ? "active" : ""} onClick={() => setScope(s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
            {board && <span style={{ fontSize: "13px", color: "var(--muted)" }}>Jami: {board.total} talaba</span>}
          </div>

          <section className="card" style={{ padding: "8px 0", overflow: "hidden" }}>
            {!board ? (
              <p style={{ margin: 0, padding: "28px 24px", textAlign: "center", color: "var(--muted)", fontSize: "14px" }}>Yuklanmoqda…</p>
            ) : rows.length === 0 ? (
              <p style={{ margin: 0, padding: "28px 24px", textAlign: "center", color: "var(--muted)", fontSize: "14px" }}>
                Bu bo‘limda hozircha talabalar yo‘q.
              </p>
            ) : (
              rows.map((r, i) => (
                <div key={`${r.rank}-${r.name}-${i}`}>
                  {board.me && i === board.top.length && (
                    <div style={{ padding: "2px 24px", color: "var(--subtle)", fontSize: "13px" }}>⋯</div>
                  )}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "48px 1fr auto",
                      alignItems: "center",
                      gap: "14px",
                      padding: "12px 24px",
                      background: r.is_me ? "var(--accent-soft)" : undefined,
                      borderTop: i === 0 ? undefined : "1px solid var(--border-soft)",
                    }}
                  >
                    <span
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 800,
                        fontSize: "14px",
                        color: r.rank <= 3 ? "white" : "var(--text-2)",
                        background: r.rank === 1 ? "var(--warning-400)" : r.rank <= 3 ? "var(--accent-300)" : "var(--surface-3)",
                      }}
                    >
                      {r.rank}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ color: "var(--navy)", fontSize: "14.5px" }}>
                        {r.name} {r.is_me && <span style={{ color: "var(--accent)", fontWeight: 700 }}>· Siz</span>}
                      </strong>
                      {r.group && <div style={{ fontSize: "12.5px", color: "var(--muted)" }}>{r.group}</div>}
                    </div>
                    <strong style={{ color: "var(--navy)", fontSize: "15px" }}>{r.score}</strong>
                  </div>
                </div>
              ))
            )}
          </section>

          {isPublic === false && (
            <p style={{ margin: "14px 0 0", fontSize: "13.5px", color: "var(--text-3)", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <Icon name="eyeOff" size={15} /> Boshqa talabalar sizni “Talaba #…” deb ko‘radi.
              <button className="text-button" onClick={onOpenSettings}>
                Ismimni ko‘rsatish <Icon name="arrow" size={14} />
              </button>
            </p>
          )}
        </>
      )}
    </div>
  );
}
