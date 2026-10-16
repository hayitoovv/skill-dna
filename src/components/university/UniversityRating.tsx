import { useEffect, useState } from "react";
import { Icon } from "../common/Icons";
import { api, type RatingBoard } from "../../services/api";

/** Staff view of the student rating: the whole university or one group, with full names. */
export default function UniversityRating() {
  const [group, setGroup] = useState("");
  const [board, setBoard] = useState<RatingBoard | null>(null);
  const [groups, setGroups] = useState<string[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    setBoard(null);
    api
      .getRating(group ? "group" : "university", { groupId: group || undefined, limit: 50 })
      .then((b) => {
        setBoard(b);
        if (b.groups) setGroups(b.groups);
        setError(false);
      })
      .catch(() => setError(true));
  }, [group]);

  return (
    <section className="card" style={{ padding: "26px" }}>
      <div className="card-heading" style={{ marginBottom: "16px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <p className="card-kicker">TALABALAR REYTINGI</p>
          <h2>{group ? `${group} guruhi reytingi` : "Universitet bo‘yicha reyting"}</h2>
        </div>
        <div className="filter-row" style={{ margin: 0 }}>
          <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Guruh">
            <option value="">Barcha guruhlar</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <p style={{ margin: 0, fontSize: "13.5px", color: "var(--muted)" }}>Reytingni yuklab bo‘lmadi. Server ishlayotganini tekshiring.</p>
      ) : !board ? (
        <p style={{ margin: 0, fontSize: "13.5px", color: "var(--muted)" }}>Yuklanmoqda…</p>
      ) : board.top.length === 0 ? (
        <p style={{ margin: 0, fontSize: "13.5px", color: "var(--muted)" }}>Hozircha talabalar yo‘q.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: "12px", textTransform: "uppercase" }}>
                <th style={{ padding: "8px 10px", width: "60px" }}>O‘rin</th>
                <th style={{ padding: "8px 10px" }}>Talaba</th>
                <th style={{ padding: "8px 10px" }}>Guruh</th>
                <th style={{ padding: "8px 10px", textAlign: "right" }}>Reyting bali</th>
              </tr>
            </thead>
            <tbody>
              {board.top.map((r) => (
                <tr key={r.user_id ?? `${r.rank}-${r.name}`} style={{ borderTop: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "10px", fontWeight: 800, color: r.rank <= 3 ? "var(--accent)" : "var(--text-2)" }}>
                    {r.rank <= 3 ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <Icon name="trophy" size={14} /> {r.rank}
                      </span>
                    ) : (
                      r.rank
                    )}
                  </td>
                  <td style={{ padding: "10px", fontWeight: 600, color: "var(--navy)" }}>{r.name}</td>
                  <td style={{ padding: "10px", color: "var(--muted)" }}>{r.group ?? "—"}</td>
                  <td style={{ padding: "10px", textAlign: "right", fontWeight: 700, color: "var(--navy)" }}>{r.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {board.total > board.top.length && (
            <p style={{ margin: "10px 0 0", fontSize: "12.5px", color: "var(--muted)" }}>
              Birinchi {board.top.length} ta talaba ko‘rsatilmoqda · jami {board.total}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
