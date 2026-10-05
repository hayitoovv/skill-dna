import { useEffect, useState } from "react";
import { Icon } from "../common/Icons";
import { api, hasSession } from "../../services/api";

interface Invite {
  id: string;
  company: string | null;
  job_title: string;
  message: string | null;
  status: "sent" | "accepted" | "declined";
  created_at: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};

/** Invitations from employers; hidden when there are none. */
export default function StudentInvites() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api
      .getMyInvites()
      .then((rows) => setInvites(rows as Invite[]))
      .catch(() => setInvites([]));

  useEffect(() => {
    if (hasSession()) void load();
  }, []);

  if (invites.length === 0) return null;

  const respond = async (inv: Invite, decision: "accepted" | "declined") => {
    setBusy(inv.id);
    setError(null);
    try {
      await api.respondInvite(inv.id, decision);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Javob yuborilmadi");
    } finally {
      setBusy(null);
    }
  };

  const pending = invites.filter((i) => i.status === "sent").length;

  return (
    <section className="card" style={{ padding: 20, marginBottom: 18, borderLeft: "4px solid var(--success)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--success-soft)", color: "var(--success)", display: "grid", placeItems: "center" }}>
          <Icon name="briefcase" size={19} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: "var(--navy)" }}>Ish beruvchilardan takliflar</h3>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {pending > 0 ? `${pending} ta taklif javobingizni kutmoqda` : "Barcha takliflarga javob berilgan"}
          </div>
        </div>
      </div>
      {error && <div style={{ color: "var(--rose)", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {invites.map((inv) => (
          <div
            key={inv.id}
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              padding: "12px 14px",
              borderRadius: 12,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ minWidth: 0, flex: "1 1 260px" }}>
              <div style={{ fontWeight: 700, color: "var(--navy)", fontSize: 14 }}>{inv.job_title}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                {inv.company ?? "Ish beruvchi"} · {fmtDate(inv.created_at)}
              </div>
              {inv.message && <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 6 }}>“{inv.message}”</div>}
            </div>
            {inv.status === "sent" ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="ghost-button" type="button" disabled={busy === inv.id} onClick={() => void respond(inv, "declined")}>
                  Rad etish
                </button>
                <button className="primary-button" type="button" disabled={busy === inv.id} onClick={() => void respond(inv, "accepted")}>
                  {busy === inv.id ? "…" : "Qabul qilish"}
                </button>
              </div>
            ) : (
              <span className={`inv-status ${inv.status === "accepted" ? "inv-status-accepted" : "inv-status-declined"}`}>
                <Icon name={inv.status === "accepted" ? "checkCircle" : "close"} size={13} />
                {inv.status === "accepted" ? "Qabul qildingiz" : "Rad etdingiz"}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
