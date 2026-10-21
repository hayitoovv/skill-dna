import { useEffect, useState } from "react";
import { Icon } from "../common/Icons";
import { api, type RatingBoard, type RatingEntry, type RatingScope, type RatingSummary, type RatingPlace } from "../../services/api";

const SCOPES: { key: RatingScope; label: string }[] = [
  { key: "university", label: "Universitet" },
  { key: "direction", label: "Yo‘nalish" },
  { key: "group", label: "Guruh" },
];

const BOARD_LIMIT = 20;
const RING_RADIUS = 52;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

// Soft background + strong foreground pairs from the design tokens; a name always gets the same pair
const AVATAR_COLORS = [
  ["var(--accent-soft-2)", "var(--accent)"],
  ["var(--success-soft)", "var(--success-fg)"],
  ["var(--warning-soft)", "var(--warning-fg)"],
  ["var(--danger-soft)", "var(--danger-fg)"],
  ["var(--surface-3)", "var(--text-2)"],
  ["var(--accent-soft)", "var(--accent-400)"],
];

const placeText = (p: RatingPlace) => (p ? `${p.rank}-o‘rin / ${p.total}` : "—");

/** Share of the scope the student is ahead of, 0–100 (the only student counts as 100). */
const aheadPct = (p: RatingPlace) => (!p ? 0 : p.total <= 1 ? 100 : Math.round(((p.total - p.rank) / (p.total - 1)) * 100));

function initials(name: string) {
  if (name.startsWith("Talaba #")) return "#";
  return name.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function Avatar({ name }: { name: string }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, fg] = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  return (
    <span className="rating-avatar" style={{ background: bg, color: fg }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

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

function ScoreCard({ me }: { me: RatingSummary | null }) {
  const score = me?.score ?? 0;
  const uni = me?.university ?? null;
  return (
    <section className="card rating-score-card">
      <div className="rating-ring">
        <svg viewBox="0 0 124 124" aria-hidden="true">
          <circle className="rating-ring-track" cx="62" cy="62" r={RING_RADIUS} />
          <circle
            className="rating-ring-fill"
            cx="62"
            cy="62"
            r={RING_RADIUS}
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - Math.min(100, Math.max(0, score)) / 100)}
          />
        </svg>
        <div className="rating-ring-value">
          <strong>{me ? score : "—"}</strong>
          <span>/ 100</span>
        </div>
      </div>
      <div className="rating-score-text">
        <div className="label">Reyting bali</div>
        <h2>{uni ? `${uni.rank}-o‘rin` : "Hali hisoblanmagan"}</h2>
        {uni && (
          <>
            <p className="rating-score-sub">Universitetda, {uni.total} talaba orasida</p>
            {uni.top_pct != null && (
              <span className="rating-chip">
                <Icon name="trophy" size={13} /> Eng yaxshi {uni.top_pct}%
              </span>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function PlaceCard({ label, detail, place, icon }: { label: string; detail?: string | null; place: RatingPlace; icon: "university" | "layers" | "users" }) {
  const pct = aheadPct(place);
  return (
    <section className="card rating-place">
      <div className="rating-place-head">
        <span className="rating-place-icon">
          <Icon name={icon} size={19} />
        </span>
        <div className="rating-place-label">
          {label}
          {detail && <small title={detail}>{detail}</small>}
        </div>
      </div>
      <div className="rating-place-value">
        <strong>{place ? `${place.rank}-o‘rin` : "—"}</strong>
        {place && <span>/ {place.total}</span>}
      </div>
      <div>
        <div className="rating-meter" role="img" aria-label={`Talabalarning ${pct}% idan oldinda`}>
          <i style={{ width: `${Math.max(pct, 3)}%` }} />
        </div>
        <div className="rating-place-foot" style={{ marginTop: "8px" }}>
          <span>{place ? `${place.total - place.rank} talabadan oldinda` : "Ma’lumot yo‘q"}</span>
          {place?.top_pct != null && <span>Top {place.top_pct}%</span>}
        </div>
      </div>
    </section>
  );
}

function Podium({ top }: { top: RatingEntry[] }) {
  // Second, first, third: the winner stands in the middle
  const order = [top[1], top[0], top[2]];
  return (
    <section className="rating-podium" aria-label="Eng yaxshi uch talaba">
      {order.map((r) => (
        <div key={`${r.rank}-${r.name}`} className={`card rating-podium-card place-${Math.min(r.rank, 3)}${r.is_me ? " is-me" : ""}`}>
          {r.rank === 1 && (
            <span className="rating-crown">
              <Icon name="trophy" size={18} />
            </span>
          )}
          <div className="rating-podium-avatar">
            <Avatar name={r.name} />
            <span className="rating-medal">{r.rank}</span>
          </div>
          <div className="name" title={r.name}>
            {r.name}
          </div>
          {r.is_me ? <span className="rating-me-pill">Siz</span> : r.group && <span className="rating-group">{r.group}</span>}
          <div className="rating-podium-score">
            {r.score} <small>ball</small>
          </div>
        </div>
      ))}
    </section>
  );
}

function Row({ r, delay }: { r: RatingEntry; delay: number }) {
  return (
    <div className={`rating-row${r.is_me ? " is-me" : ""}`} style={{ animationDelay: `${delay}ms` }}>
      <span className="rating-rank">{r.rank}</span>
      <Avatar name={r.name} />
      <div className="rating-who">
        <div className="name">
          <span>{r.name}</span>
          {r.is_me && <span className="rating-me-pill">Siz</span>}
        </div>
        {r.group && <span className="rating-group">{r.group}</span>}
      </div>
      <div className="rating-bar" aria-hidden="true">
        <i style={{ width: `${Math.max(Math.min(r.score, 100), 2)}%`, animationDelay: `${delay}ms` }} />
      </div>
      <span className="rating-score">{r.score}</span>
    </div>
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
    api.getRating(scope, { limit: BOARD_LIMIT }).then(setBoard).catch(() => setError(true));
  }, [scope, refreshKey]);

  const top = board?.top ?? [];
  const showPodium = top.length >= 3;
  const listRows = showPodium ? top.slice(3) : top;

  return (
    <div className="page rating-page">
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
        <section className="card rating-empty">Reytingni yuklab bo‘lmadi. Server ishlayotganini tekshiring.</section>
      ) : (
        <>
          <div className="rating-hero">
            <ScoreCard me={me} />
            <div className="rating-places">
              <PlaceCard label="Universitetda" place={me?.university ?? null} icon="university" />
              <PlaceCard label="Yo‘nalishda" detail={me?.direction_name} place={me?.direction ?? null} icon="layers" />
              <PlaceCard label="Guruhda" detail={me?.group_id} place={me?.group ?? null} icon="users" />
            </div>
          </div>

          <div className="rating-toolbar">
            <div className="filter-tabs">
              {SCOPES.map((s) => (
                <button key={s.key} className={scope === s.key ? "active" : ""} onClick={() => setScope(s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
            {board && (
              <span className="rating-total">
                <Icon name="users" size={15} /> Jami: {board.total} talaba
              </span>
            )}
          </div>

          {!board ? (
            <section className="card rating-empty">Yuklanmoqda…</section>
          ) : top.length === 0 ? (
            <section className="card rating-empty">Bu bo‘limda hozircha talabalar yo‘q.</section>
          ) : (
            <>
              {showPodium && <Podium top={top} />}
              {(listRows.length > 0 || board.me) && (
                <section className="card rating-list">
                  {listRows.map((r, i) => (
                    <Row key={`${r.rank}-${r.name}-${i}`} r={r} delay={Math.min(i, 12) * 30} />
                  ))}
                  {board.me && (
                    <>
                      <div className="rating-gap">Sizning o‘rningiz</div>
                      <Row r={board.me} delay={0} />
                    </>
                  )}
                </section>
              )}
            </>
          )}

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
