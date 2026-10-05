import { useState } from "react";
import { Icon } from "../common/Icons";

interface InviteModalProps {
  candidateName: string;
  defaultJobTitle?: string;
  onClose: () => void;
  /** Sends the invite; throw to show the error inside the modal. */
  onSubmit: (jobTitle: string, message: string) => Promise<void>;
}

export default function InviteModal({ candidateName, defaultJobTitle = "", onClose, onSubmit }: InviteModalProps) {
  const [jobTitle, setJobTitle] = useState(defaultJobTitle);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (jobTitle.trim().length < 2 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(jobTitle.trim(), message.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Taklif yuborilmadi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-title"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: "min(500px, 100%)" }}
      >
        <button className="modal-close" aria-label="Yopish" onClick={onClose}>
          <Icon name="close" size={18} />
        </button>
        <div className="modal-symbol">
          <Icon name="briefcase" size={22} />
        </div>
        <h2 id="invite-title">Suhbatga taklif</h2>
        <p>
          <strong>{candidateName}</strong> taklifni o‘z profilida ko‘radi va qabul qilishi yoki rad etishi mumkin. Javob “Takliflar
          jurnali”da paydo bo‘ladi.
        </p>
        <form onSubmit={submit} className="form-grid" style={{ gridTemplateColumns: "1fr", marginTop: 18 }}>
          <label>
            Lavozim
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Masalan: Junior Backend Developer"
              maxLength={255}
              autoFocus
              required
            />
          </label>
          <label>
            Xabar (ixtiyoriy)
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Suhbat vaqti, format yoki aloqa ma’lumotlari"
              maxLength={2000}
            />
          </label>
          {error && <div style={{ color: "var(--rose)", fontSize: 13, fontWeight: 600 }}>{error}</div>}
          <button className="primary-button full" type="submit" disabled={busy || jobTitle.trim().length < 2}>
            {busy ? "Yuborilmoqda…" : "Taklif yuborish"}
          </button>
        </form>
        <p style={{ fontSize: 12 }}>
          Platforma natijasi ishga olish qarorining yagona asosi bo‘lmasligi kerak — suhbat orqali tasdiqlang.
        </p>
      </div>
    </div>
  );
}
