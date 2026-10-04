import QRCode from "qrcode";

export interface PrintableCredential {
  id: string;
  code: string;
  title: string;
  level: string;
  status: string;
  issued_at: string;
  verify_url: string;
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function credentialQr(url: string, size = 220): Promise<string> {
  return QRCode.toDataURL(url, { width: size, margin: 1, errorCorrectionLevel: "M", color: { dark: "#0f2744", light: "#ffffff" } });
}

/**
 * Opens a print-ready certificate (PDF via the browser's "Save as PDF") with a QR code that points to
 * the open verification endpoint, so anyone can check the signature and revocation status (section 3.4-C).
 * The window is opened synchronously so popup blockers allow it, then filled once the QR is ready.
 */
export async function printCredential(c: PrintableCredential, holderName: string): Promise<void> {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) throw new Error("Brauzer yangi oynani blokladi — popup’larga ruxsat bering.");
  const qr = await credentialQr(c.verify_url);
  const issued = new Date(c.issued_at).toLocaleDateString("uz-UZ", { year: "numeric", month: "long", day: "numeric" });
  win.document.write(`<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>${escape(c.code)} — SKILL DNA</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Geist", system-ui, sans-serif; color: #0f172a; background: #f3f6fa; }
  .sheet { max-width: 1000px; margin: 24px auto; background: #fff; border-radius: 18px; padding: 44px 52px;
    border: 1px solid #e2e8f0; box-shadow: 0 30px 60px -20px rgba(15,39,68,.25); position: relative; overflow: hidden; }
  .sheet::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 8px; background: linear-gradient(90deg, #1e3a8a, #10b981); }
  .brand { font-weight: 800; letter-spacing: .06em; color: #0f2744; } .brand span { color: #059669; }
  .kicker { margin-top: 30px; font-size: 13px; letter-spacing: .14em; color: #64748b; font-weight: 700; }
  h1 { margin: 10px 0 6px; font-size: 34px; color: #0f2744; letter-spacing: -.02em; }
  .holder { font-size: 20px; margin-top: 18px; } .holder b { color: #0f2744; }
  .level { display: inline-block; margin-top: 14px; padding: 6px 14px; border-radius: 999px; background: #ecfdf5; color: #047857; font-weight: 800; }
  .row { display: flex; justify-content: space-between; align-items: flex-end; gap: 30px; margin-top: 36px; }
  .meta { font-size: 13px; color: #475569; line-height: 1.8; } .meta b { color: #0f172a; }
  .qr { text-align: center; font-size: 11px; color: #64748b; } .qr img { width: 150px; height: 150px; display: block; margin: 0 auto 6px; }
  .revoked { position: absolute; top: 40%; left: 50%; transform: translate(-50%,-50%) rotate(-18deg); font-size: 72px; font-weight: 900;
    color: rgba(220,38,38,.18); border: 8px solid rgba(220,38,38,.18); padding: 4px 24px; border-radius: 16px; }
  .note { margin-top: 26px; font-size: 11px; color: #94a3b8; }
  @media print { body { background: #fff; } .sheet { box-shadow: none; margin: 0; max-width: none; } .noprint { display: none; } }
</style></head><body>
<div class="sheet">
  ${c.status !== "issued" ? '<div class="revoked">BEKOR QILINGAN</div>' : ""}
  <div class="brand">SKILL <span>DNA</span> · Verified Skill Credential</div>
  <div class="kicker">OPEN BADGES 3.0 · W3C VERIFIABLE CREDENTIAL</div>
  <h1>${escape(c.title)}</h1>
  <div class="holder">Egasi: <b>${escape(holderName)}</b></div>
  <div class="level">${escape(c.level)}</div>
  <div class="row">
    <div class="meta">
      Sertifikat ID: <b>${escape(c.code)}</b><br>
      Berilgan sana: <b>${escape(issued)}</b><br>
      Holat: <b>${c.status === "issued" ? "Faol" : "Bekor qilingan"}</b><br>
      Tekshirish: <b>${escape(c.verify_url)}</b>
    </div>
    <div class="qr"><img src="${qr}" alt="Tekshiruv QR kodi">QR orqali imzo va holatni tekshiring</div>
  </div>
  <div class="note">Daraja 5 qatlamli dalil (KNOW · DO · ADAPT · DEFEND · PROVE) asosida berilgan va ES256 kalit bilan raqamli imzolangan.
  Credential bekor qilinsa, QR orqali tekshiruv buni ko‘rsatadi.</div>
</div>
<p class="noprint" style="text-align:center"><button onclick="window.print()" style="padding:10px 18px;border-radius:10px;border:0;background:#1e3a8a;color:#fff;font-weight:700;cursor:pointer">PDF sifatida saqlash / chop etish</button></p>
</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}
