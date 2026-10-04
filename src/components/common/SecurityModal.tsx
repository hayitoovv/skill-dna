import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Icon } from "./Icons";
import { api } from "../../services/api";

type Status = { enabled: boolean; required: boolean; recommended: boolean; session_verified: boolean; recovery_codes_left: number };

/** Two-factor authentication settings (architecture section 13.1: required for admin/moderator). */
export default function SecurityModal({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api
      .getMfaStatus()
      .then(setStatus)
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const startSetup = () =>
    run(async () => {
      const s = await api.setupMfa();
      const qr = await QRCode.toDataURL(s.otpauth_uri, { width: 200, margin: 1, color: { dark: "#0f2744", light: "#ffffff" } });
      setSetup({ secret: s.secret, qr });
      setCode("");
    });

  const enable = () =>
    run(async () => {
      const r = await api.enableMfa(code.trim());
      setRecovery(r.recovery_codes);
      setSetup(null);
      setCode("");
      await load();
    });

  const disable = () =>
    run(async () => {
      await api.disableMfa(code.trim());
      setCode("");
      await load();
    });

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="security-title" onMouseDown={(e) => e.stopPropagation()} style={{ width: "min(480px, 100%)" }}>
        <button className="modal-close" aria-label="Yopish" onClick={onClose}>
          <Icon name="close" />
        </button>
        <div className="modal-symbol">
          <Icon name="shieldCheck" size={26} />
        </div>
        <h2 id="security-title">Ikki bosqichli tasdiq (2FA)</h2>
        <p>Kirishda parol bilan birga Authenticator ilovasidagi (Google Authenticator, Microsoft Authenticator, 1Password) kod so‘raladi.</p>

        {status && (
          <div style={{ margin: "14px 0", padding: "10px 12px", borderRadius: 12, background: status.enabled ? "var(--success-soft)" : status.recommended ? "var(--warning-soft)" : "var(--surface-3)", fontSize: 13 }}>
            {status.enabled
              ? `Yoqilgan · tiklash kodlari: ${status.recovery_codes_left} ta`
              : status.required
              ? "Bu rol uchun 2FA majburiy: yoqmaguningizcha xodimlar bo‘limlari yopiq."
              : status.recommended
              ? "Bu rol uchun 2FA tavsiya etiladi (moderator / admin)."
              : "O‘chirilgan"}
            {status.enabled && !status.session_verified && " · joriy sessiya kodsiz ochilgan — qayta kirib tasdiqlang."}
          </div>
        )}

        {recovery && (
          <div style={{ margin: "12px 0", padding: 12, borderRadius: 12, border: "1px dashed var(--warning-400)", background: "var(--warning-soft)" }}>
            <strong style={{ fontSize: 13, color: "var(--warning-fg)" }}>Tiklash kodlari — hozir saqlab oling, ular boshqa ko‘rsatilmaydi:</strong>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8, fontFamily: "Geist Mono, monospace", fontSize: 13 }}>
              {recovery.map((r) => (
                <code key={r}>{r}</code>
              ))}
            </div>
          </div>
        )}

        {setup && (
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "center", margin: "12px 0" }}>
            <img src={setup.qr} alt="2FA QR kodi" width={150} height={150} style={{ borderRadius: 10, border: "1px solid var(--border)" }} />
            <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>
              1. Ilovada QR kodni skanerlang.<br />
              2. Yoki kalitni qo‘lda kiriting:
              <code style={{ display: "block", marginTop: 6, wordBreak: "break-all", fontSize: 12 }}>{setup.secret}</code>
            </div>
          </div>
        )}

        {(setup || status?.enabled) && (
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6 xonali kod"
            aria-label="Tasdiqlash kodi"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid var(--border)", fontSize: 15, letterSpacing: ".2em", marginBottom: 10 }}
          />
        )}

        {error && <p role="alert" style={{ color: "var(--danger-fg)", fontSize: 12.5, margin: "0 0 10px" }}>{error}</p>}

        {status && !status.enabled && !setup && (
          <button className="primary-button full" onClick={startSetup} disabled={busy}>
            <Icon name="shieldCheck" size={16} /> 2FA’ni sozlash
          </button>
        )}
        {setup && (
          <button className="primary-button full" onClick={enable} disabled={busy || code.trim().length < 6}>
            Kodni tasdiqlab yoqish
          </button>
        )}
        {status?.enabled && (
          <button className="secondary-button" style={{ width: "100%" }} onClick={disable} disabled={busy || code.trim().length < 6}>
            2FA’ni o‘chirish (joriy kod bilan)
          </button>
        )}
      </div>
    </div>
  );
}
