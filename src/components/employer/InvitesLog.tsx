import { useEffect, useMemo, useState } from "react";
import { Icon } from "../common/Icons";
import type { IconName } from "../common/Icons";
import { api, hasSession } from "../../services/api";

type DataMode = "loading" | "live" | "demo";
type Status = "sent" | "accepted" | "declined" | "withdrawn";

interface InviteRow {
  id: string;
  candidate_id: string;
  name: string | null;
  direction: string | null;
  course: string | null;
  job_title: string;
  message: string | null;
  status: Status;
  created_at: string;
  responded_at: string | null;
}

const STATUS_META: Record<Status, { label: string; icon: IconName; cls: string }> = {
  sent: { label: "Javob kutilmoqda", icon: "clock", cls: "inv-status-sent" },
  accepted: { label: "Qabul qilindi", icon: "checkCircle", cls: "inv-status-accepted" },
  declined: { label: "Rad etildi", icon: "close", cls: "inv-status-declined" },
  withdrawn: { label: "Qaytarib olindi", icon: "refresh", cls: "inv-status-withdrawn" },
};

const FILTERS: { key: Status | "all"; label: string }[] = [
  { key: "all", label: "Barchasi" },
  { key: "sent", label: "Kutilmoqda" },
  { key: "accepted", label: "Qabul qilingan" },
  { key: "declined", label: "Rad etilgan" },
  { key: "withdrawn", label: "Qaytarib olingan" },
];

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const DEMO_ROWS: InviteRow[] = [
  { id: "d1", candidate_id: "cand-1", name: "Azizbek Sobirov", direction: "Dasturiy injiniring", course: "3-kurs", job_title: "Junior Backend Developer",
    message: "Texnik suhbat: seshanba, 15:00, IT Park.", status: "accepted", created_at: daysAgo(4), responded_at: daysAgo(3) },
  { id: "d2", candidate_id: "cand-2", name: "Malika Karimova", direction: "Sun’iy intellekt", course: "4-kurs", job_title: "ML Engineer (stajyor)",
    message: null, status: "sent", created_at: daysAgo(1), responded_at: null },
  { id: "d3", candidate_id: "cand-3", name: "Jasur Toshmatov", direction: "Kompyuter injiniringi", course: "3-kurs", job_title: "Network Engineer",
    message: null, status: "declined", created_at: daysAgo(9), responded_at: daysAgo(7) },
];

const pad = (n: number) => String(n).padStart(2, "0");
// Browsers render uz-UZ short months as "M10", so the format is explicit: dd.mm.yyyy, hh:mm
const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function InvitesLog({ onFindCandidates }: { onFindCandidates?: () => void }) {
  const [mode, setMode] = useState<DataMode>(() => (hasSession() ? "loading" : "demo"));
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api
      .getEmployerInvites()
      .then((data) => {
        setRows(data as InviteRow[]);
        setMode("live");
      })
      .catch(() => setMode((m) => (m === "live" ? m : "demo")));

  useEffect(() => {
    if (hasSession()) void load();
  }, []);

  const isLive = mode === "live";
  const source = isLive ? rows : mode === "demo" ? DEMO_ROWS : [];
  const shown = useMemo(() => (filter === "all" ? source : source.filter((r) => r.status === filter)), [source, filter]);

  const count = (s: Status) => source.filter((r) => r.status === s).length;
  const answered = count("accepted") + count("declined");
  const acceptRate = answered ? Math.round((count("accepted") / answered) * 100) : null;

  const withdraw = async (row: InviteRow) => {
    setError(null);
    if (!isLive) {
      setError("Demo rejimida taklifni qaytarib bo‘lmaydi.");
      return;
    }
    setBusyId(row.id);
    try {
      await api.withdrawInvite(row.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Taklifni qaytarib bo‘lmadi");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page">
      <section className="welcome-row">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <p className="eyebrow" style={{ margin: 0 }}>ISH BERUVCHI PANELI · TAKLIFLAR</p>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 9px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                background: isLive ? "var(--success-soft)" : "var(--surface-3)",
                color: isLive ? "var(--success)" : "var(--muted)",
                border: isLive ? "1px solid var(--success-ring)" : "1px solid var(--border)",
              }}
            >
              {isLive && <span className="live-pulse-indicator" />}
              {mode === "loading" ? "Yuklanmoqda…" : isLive ? "Jonli ma’lumot" : "Demo ma’lumot"}
            </span>
          </div>
          <h1>Takliflar jurnali</h1>
          <p className="subtitle">Yuborilgan suhbat takliflari va nomzodlarning javoblari. Har bir amal audit jurnaliga yoziladi.</p>
        </div>
        {isLive && (
          <button className="secondary-button" type="button" onClick={() => void load()} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Icon name="refresh" size={15} /> Yangilash
          </button>
        )}
      </section>

      <section className="employer-stats-row">
        {[
          { icon: "mail" as IconName, label: "Jami yuborilgan", value: source.length, tone: "var(--accent)", soft: "var(--accent-soft)" },
          { icon: "clock" as IconName, label: "Javob kutilmoqda", value: count("sent"), tone: "var(--warning-fg)", soft: "var(--warning-soft)" },
          { icon: "checkCircle" as IconName, label: "Qabul qilingan", value: count("accepted"), tone: "var(--success)", soft: "var(--success-soft)" },
          {
            icon: "chart" as IconName,
            label: "Qabul qilish ulushi",
            value: acceptRate === null ? "—" : `${acceptRate}%`,
            tone: "var(--royal)",
            soft: "var(--surface-3)",
          },
        ].map((s) => (
          <div className="employer-stat-pill" key={s.label}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: s.soft, color: s.tone, display: "grid", placeItems: "center" }}>
              <Icon name={s.icon} size={20} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>{s.label}</div>
              <strong style={{ fontSize: 19, color: "var(--navy)" }}>{s.value}</strong>
            </div>
          </div>
        ))}
      </section>

      <section className="employer-filter-card" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {FILTERS.map((f) => {
          const n = f.key === "all" ? source.length : count(f.key);
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              style={{
                padding: "8px 13px",
                borderRadius: 10,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                border: active ? "1px solid var(--accent-ring)" : "1px solid var(--border)",
                background: active ? "var(--accent-soft)" : "var(--surface-2)",
                color: active ? "var(--royal)" : "var(--text-2)",
              }}
            >
              {f.label} <span style={{ opacity: 0.7 }}>({n})</span>
            </button>
          );
        })}
      </section>

      {error && (
        <div className="card" style={{ padding: "12px 16px", color: "var(--rose)", fontWeight: 600, fontSize: 13 }}>
          {error}
        </div>
      )}

      {mode === "loading" ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Takliflar yuklanmoqda…</div>
      ) : shown.length === 0 ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>
          <div style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--surface-3)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
            <Icon name="mail" size={24} />
          </div>
          <h3 style={{ margin: "0 0 6px", color: "var(--navy)", fontSize: 17 }}>
            {source.length === 0 ? "Hali taklif yuborilmagan" : "Bu holatdagi taklif yo‘q"}
          </h3>
          {source.length === 0 && (
            <>
              <p style={{ margin: "0 auto 16px", fontSize: 13.5, maxWidth: 440 }}>
                Nomzodlar qidiruvi yoki tasdiqlangan nomzodlar sahifasidan suhbatga taklif yuboring — ular shu yerda paydo bo‘ladi.
              </p>
              {onFindCandidates && (
                <button className="primary-button" type="button" onClick={onFindCandidates}>
                  Tasdiqlangan nomzodlarni ko‘rish
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Nomzod</th>
                  <th>Lavozim</th>
                  <th>Yuborilgan</th>
                  <th>Holat</th>
                  <th>Javob vaqti</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const meta = STATUS_META[r.status] ?? STATUS_META.sent;
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.name ?? "—"}</strong>
                        <div className="inv-sub">
                          {r.direction ?? "—"}
                          {r.course ? ` · ${r.course}` : ""}
                        </div>
                      </td>
                      <td>
                        {r.job_title}
                        {r.message && (
                          <div className="inv-sub" title={r.message}>
                            “{r.message.length > 70 ? `${r.message.slice(0, 70)}…` : r.message}”
                          </div>
                        )}
                      </td>
                      <td className="inv-nowrap">{fmtDate(r.created_at)}</td>
                      <td>
                        <span className={`inv-status ${meta.cls}`}>
                          <Icon name={meta.icon} size={13} /> {meta.label}
                        </span>
                      </td>
                      <td className="inv-nowrap">{fmtDate(r.responded_at)}</td>
                      <td style={{ textAlign: "right" }}>
                        {r.status === "sent" && (
                          <button
                            type="button"
                            className="ghost-button"
                            disabled={busyId === r.id}
                            onClick={() => void withdraw(r)}
                            style={{ fontSize: 12.5, padding: "7px 11px", whiteSpace: "nowrap" }}
                          >
                            {busyId === r.id ? "…" : "Qaytarib olish"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
