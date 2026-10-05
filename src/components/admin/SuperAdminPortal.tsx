import { useEffect, useMemo, useState } from "react";
import { Icon } from "../common/Icons";
import type { IconName } from "../common/Icons";
import { api } from "../../services/api";
import { normalize, refreshSiteTexts, removeLocalOverride, setLocalOverride } from "../../content/siteText";
import { setEditMode } from "../../content/ContentEditor";
import AuthScreen from "../auth/AuthScreen";

export type AdminTab = "overview" | "content" | "users" | "audit";

const ROLE_LABELS: Record<string, string> = {
  student: "Talaba",
  teacher: "O‘qituvchi",
  employer: "Ish beruvchi",
  university: "Universitet",
  moderator: "Moderator",
  super_admin: "Super admin",
};

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function Header({ kicker, title, text, action }: { kicker: string; title: string; text: string; action?: React.ReactNode }) {
  return (
    <section className="welcome-row">
      <div>
        <p className="eyebrow" style={{ margin: 0 }}>{kicker}</p>
        <h1>{title}</h1>
        <p className="subtitle">{text}</p>
      </div>
      {action}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function Overview({ onOpen }: { onOpen: (tab: AdminTab) => void }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.adminOverview().then(setData).catch((e) => setError(e.message));
  }, []);

  const cards: { icon: IconName; label: string; value: number | string; tab?: AdminTab }[] = data
    ? [
        { icon: "users", label: "Foydalanuvchilar", value: data.users_total, tab: "users" },
        { icon: "edit", label: "Tahrirlangan matnlar", value: data.texts, tab: "content" },
        { icon: "file", label: "Topshiriqlar", value: data.tasks },
        { icon: "layers", label: "Urinishlar", value: data.attempts },
        { icon: "checkCircle", label: "Dalillar", value: data.evidence },
        { icon: "alertTriangle", label: "Ochiq integrity signallari", value: data.open_flags },
        { icon: "award", label: "Sertifikatlar", value: data.credentials },
        { icon: "briefcase", label: "Ish takliflari", value: data.invites },
      ]
    : [];

  return (
    <div className="page">
      <Header
        kicker="SUPER ADMIN · BOSHQARUV"
        title="Platforma boshqaruvi"
        text="Butun platforma bo‘yicha umumiy ko‘rsatkichlar. Super admin barcha portallarga kira oladi — chap yuqoridagi portal tanlagich orqali."
      />
      {error && <div className="card" style={{ padding: 16, color: "var(--rose)" }}>{error}</div>}
      {!data && !error && <div className="card" style={{ padding: 30, color: "var(--muted)" }}>Yuklanmoqda…</div>}
      {data && (
        <>
          <section className="admin-grid">
            {cards.map((c) => (
              <button key={c.label} type="button" className="admin-stat" onClick={() => c.tab && onOpen(c.tab)} disabled={!c.tab}>
                <span className="admin-stat-icon"><Icon name={c.icon} size={19} /></span>
                <span>
                  <span className="admin-stat-label">{c.label}</span>
                  <strong>{c.value}</strong>
                </span>
              </button>
            ))}
          </section>
          <section className="card" style={{ padding: 22 }}>
            <h3 style={{ margin: "0 0 14px", color: "var(--navy)" }}>Rollar bo‘yicha</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {Object.entries(data.users as Record<string, number>).map(([role, n]) => (
                <span key={role} className="admin-chip">
                  {ROLE_LABELS[role] ?? role}: <strong>{n}</strong>
                </span>
              ))}
              {data.blocked > 0 && <span className="admin-chip admin-chip-danger">Bloklangan: <strong>{data.blocked}</strong></span>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content (site texts)
// ---------------------------------------------------------------------------

function Content() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newSource, setNewSource] = useState("");
  const [newValue, setNewValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const load = () =>
    api
      .adminListTexts()
      .then(setRows)
      .catch((e) => setError(e.message));

  useEffect(() => {
    void load();
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((r) => !q || r.source.toLowerCase().includes(q) || r.value.toLowerCase().includes(q));
  }, [rows, query]);

  const save = async (source: string, value: string) => {
    setError(null);
    try {
      await api.adminSaveText(source, value);
      setLocalOverride(source, value.trim());
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saqlanmadi");
    }
  };

  const remove = async (row: any) => {
    setError(null);
    try {
      await api.adminDeleteText(row.id);
      removeLocalOverride(row.source);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "O‘chirilmadi");
    }
  };

  const addRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalize(newSource) || !newValue.trim()) return;
    await save(newSource, newValue);
    setNewSource("");
    setNewValue("");
  };

  const openPreview = () => {
    setPreview(true);
    setEditMode(true);
  };
  const closePreview = () => {
    setEditMode(false);
    setPreview(false);
    void load();
  };

  return (
    <div className="page">
      <Header
        kicker="SUPER ADMIN · KONTENT"
        title="Sayt matnlari"
        text="Saytdagi istalgan so‘z yoki jumlani o‘zgartiring. O‘zgarish barcha foydalanuvchilarda darhol ko‘rinadi, kod yoki deploy kerak emas."
        action={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="secondary-button" type="button" onClick={openPreview} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <Icon name="lock" size={15} /> Login sahifasini tahrirlash
            </button>
            <button className="primary-button" type="button" onClick={() => setEditMode(true)} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <Icon name="edit" size={15} /> Sahifada tahrirlash
            </button>
          </div>
        }
      />

      <section className="card admin-howto">
        <Icon name="sparkles" size={18} />
        <div>
          <strong>Qanday ishlaydi:</strong> “Sahifada tahrirlash”ni bosing, so‘ng istalgan portal yoki sahifaga o‘ting va matn ustiga
          bosing. Navigatsiya uchun pastdagi paneldan “Pauza”ni bosing. Til (UZ/RU/EN) bo‘yicha har bir tarjima alohida tahrirlanadi.
        </div>
      </section>

      <section className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: "0 0 12px", color: "var(--navy)", fontSize: 15 }}>Qo‘lda qoida qo‘shish</h3>
        <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: 13 }}>
          Bosib bo‘lmaydigan matnlar uchun (masalan, kiritish maydonidagi placeholder yoki tugma tooltipi): asl matnni aynan yozing.
        </p>
        <form onSubmit={addRule} data-cms-ignore className="form-grid" style={{ gridTemplateColumns: "1fr 1fr auto", alignItems: "end" }}>
          <label>
            Asl matn
            <input value={newSource} onChange={(e) => setNewSource(e.target.value)} placeholder="Masalan: Kirish" />
          </label>
          <label>
            Yangi matn
            <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Yangi jumla" />
          </label>
          <button className="primary-button" type="submit" disabled={!newSource.trim() || !newValue.trim()} style={{ height: 44 }}>
            Qo‘shish
          </button>
        </form>
      </section>

      {error && <div className="card" style={{ padding: "12px 16px", color: "var(--rose)", fontWeight: 600 }}>{error}</div>}

      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: 16, borderBottom: "1px solid var(--border)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ color: "var(--navy)" }}>O‘zgartirilgan matnlar ({rows?.length ?? 0})</strong>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Qidirish…"
            className="admin-search"
          />
          <button type="button" className="ghost-button" onClick={() => void refreshSiteTexts().then(load)} style={{ fontSize: 12.5 }}>
            Yangilash
          </button>
        </div>
        {rows === null ? (
          <div style={{ padding: 30, color: "var(--muted)" }}>Yuklanmoqda…</div>
        ) : shown.length === 0 ? (
          <div style={{ padding: 30, color: "var(--muted)", textAlign: "center" }}>
            {rows.length === 0 ? "Hali hech bir matn o‘zgartirilmagan." : "Topilmadi."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            {/* data-cms-ignore: the table shows raw sources and values, it must not be rewritten itself */}
            <table className="inv-table" data-cms-ignore>
              <thead>
                <tr>
                  <th style={{ width: "34%" }}>Asl matn</th>
                  <th>Yangi matn</th>
                  <th>Kim, qachon</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td className="inv-sub" style={{ fontSize: 13 }}>{r.source}</td>
                    <td>
                      {editing === r.id ? (
                        <textarea className="admin-textarea" value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} />
                      ) : (
                        <strong>{r.value}</strong>
                      )}
                    </td>
                    <td className="inv-nowrap">
                      {r.updated_by ?? "—"}
                      <div className="inv-sub">{fmtDate(r.updated_at)}</div>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {editing === r.id ? (
                        <>
                          <button type="button" className="ghost-button" onClick={() => setEditing(null)} style={{ fontSize: 12.5 }}>Bekor</button>{" "}
                          <button type="button" className="primary-button" disabled={!draft.trim()} onClick={() => void save(r.source, draft)} style={{ fontSize: 12.5, padding: "7px 12px" }}>
                            Saqlash
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="ghost-button" onClick={() => { setEditing(r.id); setDraft(r.value); }} style={{ fontSize: 12.5 }}>
                            Tahrirlash
                          </button>{" "}
                          <button type="button" className="ghost-button" onClick={() => void remove(r)} style={{ fontSize: 12.5, color: "var(--rose)" }}>
                            Asliga qaytarish
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {preview && (
        <div className="admin-preview">
          <div className="admin-preview-bar" data-cms-ignore>
            <strong>Login sahifasi — ko‘rib chiqish va tahrirlash</strong>
            <span>Bu yerda kirish ishlamaydi. Ro‘yxatdan o‘tish oynasiga o‘tish uchun pastdagi “Pauza”dan foydalaning.</span>
            <button type="button" className="primary-button" onClick={closePreview}>Yopish</button>
          </div>
          <div className="admin-preview-body">
            <AuthScreen onLogin={() => {}} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

function Users({ meId }: { meId: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      api.adminUsers(query.trim() || undefined, role || undefined).then(setRows).catch((e) => setError(e.message));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, role]);

  const update = async (u: any, patch: { role?: string; status?: string }) => {
    const label = patch.status === "blocked" ? `${u.full_name} bloklansinmi? U tizimga kira olmaydi.` : null;
    if (label && !window.confirm(label)) return;
    setBusy(u.id);
    setError(null);
    try {
      const next = await api.adminUpdateUser(u.id, patch);
      setRows((prev) => (prev ?? []).map((x) => (x.id === u.id ? next : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "O‘zgartirilmadi");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page">
      <Header kicker="SUPER ADMIN · FOYDALANUVCHILAR" title="Foydalanuvchilar" text="Rolni o‘zgartirish va akkauntlarni bloklash. Har bir o‘zgarish audit jurnaliga yoziladi." />
      <section className="employer-filter-card" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input className="admin-search" style={{ flex: "1 1 260px" }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ism, email yoki telefon" />
        <select value={role} onChange={(e) => setRole(e.target.value)} className="admin-select">
          <option value="">Barcha rollar</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </section>
      {error && <div className="card" style={{ padding: "12px 16px", color: "var(--rose)", fontWeight: 600 }}>{error}</div>}
      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        {rows === null ? (
          <div style={{ padding: 30, color: "var(--muted)" }}>Yuklanmoqda…</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Foydalanuvchi</th>
                  <th>Rol</th>
                  <th>Holat</th>
                  <th>Ro‘yxatdan o‘tgan</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.full_name}</strong>
                      {u.id === meId && <span className="admin-chip" style={{ marginLeft: 8, padding: "2px 7px" }}>siz</span>}
                      <div className="inv-sub">{u.email}{u.phone ? ` · ${u.phone}` : ""}</div>
                    </td>
                    <td>
                      <select
                        className="admin-select"
                        value={u.role}
                        disabled={busy === u.id || u.id === meId}
                        onChange={(e) => void update(u, { role: e.target.value })}
                      >
                        {Object.entries(ROLE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={`inv-status ${u.status === "active" ? "inv-status-accepted" : "inv-status-declined"}`}>
                        {u.status === "active" ? "Faol" : "Bloklangan"}
                      </span>
                    </td>
                    <td className="inv-nowrap">{fmtDate(u.created_at)}</td>
                    <td style={{ textAlign: "right" }}>
                      {u.id !== meId && (
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={busy === u.id}
                          onClick={() => void update(u, { status: u.status === "active" ? "blocked" : "active" })}
                          style={{ fontSize: 12.5, color: u.status === "active" ? "var(--rose)" : "var(--success)", whiteSpace: "nowrap" }}
                        >
                          {u.status === "active" ? "Bloklash" : "Faollashtirish"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 30 }}>Topilmadi</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

function Audit() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.adminAudit(300).then(setRows).catch((e) => setError(e.message));
  }, []);
  const q = query.trim().toLowerCase();
  const shown = (rows ?? []).filter((r) => !q || `${r.action} ${r.entity} ${r.actor ?? ""}`.toLowerCase().includes(q));
  return (
    <div className="page">
      <Header kicker="SUPER ADMIN · AUDIT" title="Audit jurnali" text="Platformadagi barcha muhim amallar: kim, nima qildi va qachon (oxirgi 300 ta yozuv)." />
      <section className="employer-filter-card">
        <input className="admin-search" style={{ width: "100%" }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Amal, obyekt yoki foydalanuvchi bo‘yicha qidirish" />
      </section>
      {error && <div className="card" style={{ padding: "12px 16px", color: "var(--rose)", fontWeight: 600 }}>{error}</div>}
      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        {rows === null ? (
          <div style={{ padding: 30, color: "var(--muted)" }}>Yuklanmoqda…</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Vaqt</th>
                  <th>Kim</th>
                  <th>Amal</th>
                  <th>Obyekt</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td className="inv-nowrap">{fmtDate(r.ts)}</td>
                    <td>
                      {r.actor ?? "Tizim"}
                      {r.actor_role && <div className="inv-sub">{ROLE_LABELS[r.actor_role] ?? r.actor_role}</div>}
                    </td>
                    <td><code className="admin-code">{r.action}</code></td>
                    <td className="inv-sub">{r.entity}</td>
                    <td className="inv-sub inv-nowrap">{r.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function SuperAdminPortal({ activeTab, onTabChange, meId }: { activeTab: AdminTab; onTabChange: (t: AdminTab) => void; meId: string }) {
  if (activeTab === "content") return <Content />;
  if (activeTab === "users") return <Users meId={meId} />;
  if (activeTab === "audit") return <Audit />;
  return <Overview onOpen={onTabChange} />;
}
