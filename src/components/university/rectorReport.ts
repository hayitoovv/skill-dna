/**
 * Rector's office report: a print-ready A4 page built from the same figures the dashboard shows,
 * saved as PDF through the browser's print dialog (same approach as certificates).
 */

export interface RectorReportData {
  orgName: string;
  live: boolean;
  kpis: { students: string; score: string; confidence: string; openFlags: number | null };
  directions: {
    name: string;
    students: number;
    avgScore: number | null;
    avgConfidence: number | null;
    readinessPct: number | null;
    courses: string | null;
  }[];
  levels: { level: string; count: number; pct: string }[];
  gaps: { direction: string; skill: string; badge: string; recommendation: string | null; meta: string | null }[];
  groups: { id: string; students: number }[] | null;
}

const escape = (v: unknown) =>
  String(v ?? "—").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const num = (v: number | null | undefined, suffix = "") => (v === null || v === undefined ? "—" : `${v}${suffix}`);

export function printRectorReport(d: RectorReportData): void {
  // Opened synchronously inside the click handler so popup blockers allow it
  const win = window.open("", "_blank", "width=1000,height=800");
  if (!win) throw new Error("Brauzer yangi oynani blokladi — popup’larga ruxsat bering.");

  const now = new Date();
  const date = now.toLocaleDateString("uz-UZ", { year: "numeric", month: "long", day: "numeric" });
  const time = now.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
  const maxLevel = Math.max(1, ...d.levels.map((l) => l.count));

  const directionRows = d.directions.length
    ? d.directions
        .map(
          (r) => `<tr>
        <td><strong>${escape(r.name)}</strong>${r.courses ? `<div class="sub">${escape(r.courses)}</div>` : ""}</td>
        <td class="n">${escape(r.students)}</td>
        <td class="n">${escape(num(r.avgScore))}</td>
        <td class="n">${escape(num(r.avgConfidence, "%"))}</td>
        ${d.live ? "" : `<td class="n">${escape(num(r.readinessPct, "%"))}</td>`}
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="5" class="empty">Ma’lumot yo‘q</td></tr>`;

  const levelRows = d.levels
    .map(
      (l) => `<tr>
        <td>${escape(l.level)}</td>
        <td class="bar"><span style="width:${Math.round((l.count / maxLevel) * 100)}%"></span></td>
        <td class="n">${escape(l.count)}</td>
        <td class="n">${escape(l.pct)}</td>
      </tr>`,
    )
    .join("");

  const gapItems = d.gaps.length
    ? d.gaps
        .map(
          (g) => `<li>
        <div class="gap-head"><strong>${escape(g.skill)}</strong><span class="tag">${escape(g.direction)}</span></div>
        <div class="gap-badge">${escape(g.badge)}</div>
        ${g.meta ? `<div class="sub">${escape(g.meta)}</div>` : ""}
        ${g.recommendation ? `<div class="sub">Tavsiya: ${escape(g.recommendation)}</div>` : ""}
      </li>`,
        )
        .join("")
    : `<li class="empty">Aniqlangan bo‘shliq yo‘q</li>`;

  const groupsBlock =
    d.groups && d.groups.length
      ? `<h2>Akademik guruhlar</h2>
    <table><thead><tr><th>Guruh</th><th class="n">Talabalar</th></tr></thead><tbody>
    ${d.groups.map((g) => `<tr><td>${escape(g.id)}</td><td class="n">${escape(g.students)}</td></tr>`).join("")}
    </tbody></table>`
      : "";

  win.document.write(`<!doctype html><html lang="uz"><head><meta charset="utf-8">
<title>Rektorat hisoboti — ${escape(d.orgName)} — ${escape(date)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Geist", system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f172a; background: #f3f6fa; font-size: 12.5px; }
  .sheet { max-width: 900px; margin: 24px auto; background: #fff; border-radius: 14px; padding: 36px 42px; border: 1px solid #e2e8f0; position: relative; overflow: hidden; }
  .sheet::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 6px; background: linear-gradient(90deg, #1e3a8a, #10b981); }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .brand { font-weight: 800; letter-spacing: .06em; color: #0f2744; font-size: 13px; } .brand span { color: #059669; }
  .meta { text-align: right; color: #64748b; font-size: 11.5px; line-height: 1.6; }
  .kicker { margin-top: 22px; font-size: 11px; letter-spacing: .14em; color: #64748b; font-weight: 700; text-transform: uppercase; }
  h1 { margin: 6px 0 4px; font-size: 24px; color: #0f2744; letter-spacing: -.01em; }
  .demo { display: inline-block; margin-top: 8px; padding: 4px 10px; border-radius: 6px; background: #fef3c7; color: #92400e; font-weight: 700; font-size: 11px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 22px 0 6px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; background: #f8fafc; }
  .kpi .label { color: #64748b; font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  .kpi .value { margin-top: 6px; font-size: 18px; font-weight: 800; color: #0f2744; }
  h2 { margin: 24px 0 10px; font-size: 14px; color: #0f2744; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10.5px; letter-spacing: .05em; text-transform: uppercase; color: #64748b; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
  td { padding: 7px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .n { text-align: right; white-space: nowrap; }
  .sub { color: #64748b; font-size: 11px; margin-top: 2px; }
  .bar { width: 50%; } .bar span { display: block; height: 8px; border-radius: 4px; background: linear-gradient(90deg, #1e3a8a, #10b981); min-width: 2px; }
  ul.gaps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  ul.gaps li { border: 1px solid #e2e8f0; border-left: 3px solid #dc2626; border-radius: 8px; padding: 9px 11px; break-inside: avoid; }
  .gap-head { display: flex; justify-content: space-between; gap: 8px; }
  .tag { font-size: 10px; font-weight: 700; color: #1e3a8a; background: #eff6ff; border-radius: 4px; padding: 2px 6px; white-space: nowrap; }
  .gap-badge { color: #b91c1c; font-weight: 700; font-size: 11.5px; margin-top: 4px; }
  .empty { color: #94a3b8; text-align: center; padding: 14px; }
  .method { margin-top: 24px; padding: 12px 14px; border-radius: 10px; background: #f8fafc; color: #475569; font-size: 11px; line-height: 1.6; }
  .foot { margin-top: 22px; display: flex; justify-content: space-between; color: #94a3b8; font-size: 10.5px; }
  .actions { max-width: 900px; margin: 0 auto 30px; text-align: right; }
  .actions button { font: inherit; font-weight: 700; padding: 9px 16px; border-radius: 8px; border: 0; background: #0f2744; color: #fff; cursor: pointer; }
  @media print { body { background: #fff; } .sheet { margin: 0; border: 0; border-radius: 0; padding: 0; } .sheet::before { display: none; } .actions { display: none; } }
</style></head><body>
<div class="sheet">
  <div class="top">
    <div class="brand">SKILL <span>DNA</span></div>
    <div class="meta">Tuzilgan sana: ${escape(date)}, ${escape(time)}<br>Ma’lumot manbasi: ${d.live ? "jonli (platforma bazasi)" : "namuna ma’lumot"}</div>
  </div>
  <div class="kicker">Rektorat hisoboti · Akademik natijadorlik</div>
  <h1>${escape(d.orgName)}</h1>
  ${d.live ? "" : `<div class="demo">Demo ma’lumot — haqiqiy talabalar natijasi emas</div>`}

  <div class="kpis">
    <div class="kpi"><div class="label">Talabalar</div><div class="value">${escape(d.kpis.students)}</div></div>
    <div class="kpi"><div class="label">O‘rtacha Skill Score</div><div class="value">${escape(d.kpis.score)}</div></div>
    <div class="kpi"><div class="label">O‘rtacha ishonch</div><div class="value">${escape(d.kpis.confidence)}</div></div>
    <div class="kpi"><div class="label">Ochiq integrity signallari</div><div class="value">${escape(num(d.kpis.openFlags))}</div></div>
  </div>

  <h2>Yo‘nalishlar kesimida</h2>
  <table><thead><tr><th>Yo‘nalish</th><th class="n">Talabalar</th><th class="n">O‘rt. ball</th><th class="n">Ishonch</th>${d.live ? "" : `<th class="n">Tayyorlik</th>`}</tr></thead>
  <tbody>${directionRows}</tbody></table>

  <h2>Malaka darajalari taqsimoti (L0–L5)</h2>
  <table><thead><tr><th>Daraja</th><th></th><th class="n">Soni</th><th class="n">Ulush</th></tr></thead><tbody>${levelRows}</tbody></table>

  <h2>O‘quv dasturidagi bo‘shliqlar</h2>
  <ul class="gaps">${gapItems}</ul>

  ${groupsBlock}

  <div class="method">
    <strong>Metodika.</strong> Skill Score faqat mavjud dalil qatlamlari (KNOW, DO, ADAPT, DEFEND, PROVE) bo‘yicha hisoblanadi.
    Ishonch = 0.35·Qamrov + 0.25·Izchillik + 0.15·Hajm + 0.15·Yangilik + 0.10·Tasdiq. Daraja (L1–L5) ball va ishonch
    chegaralari bo‘yicha belgilanadi (formula v1.0). Integrity signallari moderator tomonidan ko‘rib chiqiladi.
  </div>
  <div class="foot"><span>SKILL DNA — AI Talent Intelligence Platform</span><span>Real Skills · Real Opportunities</span></div>
</div>
<div class="actions"><button onclick="window.print()">PDF sifatida saqlash / Chop etish</button></div>
<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 300); });</script>
</body></html>`);
  win.document.close();
}
