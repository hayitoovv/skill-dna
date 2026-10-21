import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Icon } from "../common/Icons";
import { api, type RosterStudent } from "../../services/api";

const LOAD_ERROR = "Ma’lumotni yuklab bo‘lmadi. Server ishlayotganini tekshiring.";
const COURSES = ["1-kurs", "2-kurs", "3-kurs", "4-kurs"];
const UNASSIGNED = "__none__";

type DirectionOption = { code: string; name: string };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function PlacementModal({
  student,
  directions,
  onClose,
  onSaved,
}: {
  student: RosterStudent;
  directions: DirectionOption[];
  onClose: () => void;
  onSaved: (row: RosterStudent) => void;
}) {
  const [direction, setDirection] = useState(student.direction_code ?? "");
  const [group, setGroup] = useState(student.group_id ?? "");
  const [course, setCourse] = useState(student.course ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const directionChanged = !!direction && direction !== student.direction_code;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!direction) return setError("Yo‘nalishni tanlang.");
    setSaving(true);
    setError(null);
    try {
      onSaved(await api.placeStudent(student.id, { direction_code: direction, group_id: group, course }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlab bo‘lmadi.");
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="modal roster-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="placement-title"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <button type="button" className="modal-close" aria-label="Yopish" onClick={onClose}>
          <Icon name="close" />
        </button>
        <div className="roster-modal-head">
          <span className="roster-avatar large">{initials(student.full_name)}</span>
          <div style={{ minWidth: 0 }}>
            <h2 id="placement-title">{student.full_name}</h2>
            <span className="roster-email">{student.email}</span>
          </div>
        </div>

        {/* A div, not a label: a label forwards every click inside it to its first button */}
        <div className="roster-field" role="group" aria-labelledby="placement-direction">
          <span id="placement-direction">Yo‘nalish</span>
          <div className="roster-direction-options">
            {directions.map((d) => (
              <button
                type="button"
                key={d.code}
                className={direction === d.code ? "active" : ""}
                onClick={() => setDirection(d.code)}
                aria-pressed={direction === d.code}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>

        <div className="roster-field-row">
          <label className="roster-field">
            <span>Guruh</span>
            <input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Masalan, 941-21 DI" maxLength={100} />
          </label>
          <label className="roster-field">
            <span>Kurs</span>
            <select value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="">Belgilanmagan</option>
              {[...new Set([...COURSES, ...(student.course ? [student.course] : [])])].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        {directionChanged && (
          <p className="roster-note">
            <Icon name="alert" size={15} /> Talabaga bildirishnoma yuboriladi. Dalillari saqlanadi, reyting esa yangi yo‘nalish
            ko‘nikmalari bo‘yicha hisoblanadi.
          </p>
        )}
        {error && <p className="roster-error">{error}</p>}

        <div className="roster-modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Bekor qilish
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function UniversityStudents() {
  const [rows, setRows] = useState<RosterStudent[] | null>(null);
  const [directions, setDirections] = useState<DirectionOption[]>([]);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<RosterStudent | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    api.getRoster().then(setRows).catch(() => setError(true));
    api
      .getDirections()
      .then((list) =>
        // Only directions with skills can be studied; "general" holds shared skills only
        setDirections(list.filter((d) => d.skills?.some((s: any) => s.type === "core")).map((d) => ({ code: d.code, name: d.name }))),
      )
      .catch(() => setDirections([]));
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows ?? []) c[r.direction_code ?? UNASSIGNED] = (c[r.direction_code ?? UNASSIGNED] ?? 0) + 1;
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) =>
        (filter === "all" || (r.direction_code ?? UNASSIGNED) === filter) &&
        (!q || [r.full_name, r.email, r.group_id].some((t) => t?.toLowerCase().includes(q))),
    );
  }, [rows, query, filter]);

  const onSaved = (row: RosterStudent) => {
    setRows((prev) => (prev ?? []).map((r) => (r.id === row.id ? row : r)));
    setEditing(null);
    setSavedId(row.id);
    window.setTimeout(() => setSavedId((id) => (id === row.id ? null : id)), 2500);
  };

  const filters = [
    { key: "all", label: "Hammasi", count: rows?.length ?? 0 },
    ...directions.map((d) => ({ key: d.code, label: d.name, count: counts[d.code] ?? 0 })),
    ...(counts[UNASSIGNED] ? [{ key: UNASSIGNED, label: "Belgilanmagan", count: counts[UNASSIGNED] }] : []),
  ];

  return (
    <div className="roster">
      <div className="roster-head">
        <div>
          <h2>Talabalar va yo‘nalishlar</h2>
          <p>
            Talaba yo‘nalishni ro‘yxatdan o‘tishda tanlaydi. Rasmiy yo‘nalish, guruh va kursni shu yerda universitet belgilaydi.
          </p>
        </div>
      </div>

      {error ? (
        <section className="card roster-empty">{LOAD_ERROR}</section>
      ) : !rows ? (
        <section className="card roster-empty">Yuklanmoqda…</section>
      ) : (
        <>
          <div className="roster-toolbar">
            <label className="co-search">
              <Icon name="search" size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ism, email yoki guruh…"
                aria-label="Talabalarni qidirish"
              />
            </label>
            <div className="filter-tabs">
              {filters.map((f) => (
                <button key={f.key} className={filter === f.key ? "active" : ""} onClick={() => setFilter(f.key)}>
                  {f.label} <span className="roster-count">{f.count}</span>
                </button>
              ))}
            </div>
          </div>

          <section className="card roster-list">
            {visible.length === 0 ? (
              <p className="roster-empty">{rows.length === 0 ? "Hozircha talabalar yo‘q." : "Qidiruv bo‘yicha talaba topilmadi."}</p>
            ) : (
              visible.map((r) => (
                <div key={r.id} className={`roster-row${savedId === r.id ? " is-saved" : ""}`}>
                  <span className="roster-avatar">{initials(r.full_name)}</span>
                  <div className="roster-who">
                    <strong>
                      {r.full_name} {r.sample && <span className="roster-sample">namuna</span>}
                    </strong>
                    <span className="roster-email">{r.email}</span>
                  </div>
                  <div className="roster-tags">
                    {r.direction_name ? (
                      <span className="roster-direction">{r.direction_name}</span>
                    ) : (
                      <span className="roster-direction is-missing">
                        <Icon name="alert" size={12} /> Yo‘nalish yo‘q
                      </span>
                    )}
                    {r.group_id && <span className="roster-chip">{r.group_id}</span>}
                    {r.course && <span className="roster-chip">{r.course}</span>}
                  </div>
                  <button className="roster-edit" onClick={() => setEditing(r)} aria-label={`${r.full_name}: o‘zgartirish`}>
                    {savedId === r.id ? (
                      <>
                        <Icon name="check" size={14} /> Saqlandi
                      </>
                    ) : (
                      <>
                        <Icon name="edit" size={14} /> O‘zgartirish
                      </>
                    )}
                  </button>
                </div>
              ))
            )}
          </section>
        </>
      )}

      {editing && (
        <PlacementModal student={editing} directions={directions} onClose={() => setEditing(null)} onSaved={onSaved} />
      )}
    </div>
  );
}
