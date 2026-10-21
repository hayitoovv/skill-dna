import { useEffect, useState } from "react";
import { Icon } from "../common/Icons";
import { api, type OrgTeacher } from "../../services/api";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

/** Self-registered teachers wait here until the university admin approves or rejects them. */
export default function UniversityTeacherApprovals() {
  const [teachers, setTeachers] = useState<OrgTeacher[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    api.getOrgTeachers().then(setTeachers).catch(() => setError(true));
  }, []);

  const decide = async (t: OrgTeacher, approve: boolean) => {
    setBusy(t.id);
    setActionError(null);
    try {
      const row = await api.decideTeacher(t.id, approve);
      setTeachers((prev) => (prev ?? []).map((x) => (x.id === row.id ? row : x)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Saqlab bo‘lmadi.");
    } finally {
      setBusy(null);
    }
  };

  if (error) return null; // the mock teacher list below still renders; nothing to approve without the API
  const pending = (teachers ?? []).filter((t) => t.status === "pending");
  const active = (teachers ?? []).filter((t) => t.status === "active");

  return (
    <section className="card approvals">
      <div className="approvals-head">
        <div>
          <h3>
            <Icon name="userCheck" size={18} /> O‘qituvchi hisoblari
          </h3>
          <p>O‘zi ro‘yxatdan o‘tgan o‘qituvchi siz tasdiqlaguningizcha tizimga kira olmaydi va talabalar ma’lumotini ko‘rmaydi.</p>
        </div>
        {teachers && (
          <div className="approvals-counts">
            <span className={pending.length ? "is-pending" : ""}>{pending.length} kutmoqda</span>
            <span>{active.length} faol</span>
          </div>
        )}
      </div>

      {!teachers ? (
        <p className="approvals-empty">Yuklanmoqda…</p>
      ) : pending.length === 0 ? (
        <p className="approvals-empty">
          <Icon name="checkCircle" size={15} /> Tasdiqlash kutayotgan o‘qituvchi yo‘q.
        </p>
      ) : (
        <div className="approvals-list">
          {pending.map((t) => (
            <div key={t.id} className="approvals-row">
              <span className="roster-avatar">{initials(t.full_name)}</span>
              <div className="roster-who">
                <strong>{t.full_name}</strong>
                <span className="roster-email">
                  {t.email}
                  {t.phone ? ` · ${t.phone}` : ""}
                </span>
              </div>
              <div className="approvals-actions">
                <button className="secondary-button" disabled={busy === t.id} onClick={() => decide(t, false)}>
                  Rad etish
                </button>
                <button className="primary-button" disabled={busy === t.id} onClick={() => decide(t, true)}>
                  <Icon name="check" size={15} /> Tasdiqlash
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {actionError && <p className="roster-error">{actionError}</p>}
    </section>
  );
}
