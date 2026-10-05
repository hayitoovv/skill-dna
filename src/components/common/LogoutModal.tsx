import { useEffect, useRef } from "react";
import { Icon } from "./Icons";
import { useI18n } from "../../i18n";
import type { User } from "../../types";

interface LogoutModalProps {
  user: User;
  onClose: () => void;
  onConfirm: () => void;
}

export default function LogoutModal({ user, onClose, onConfirm }: LogoutModalProps) {
  const { t } = useI18n();
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelBtnRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const displayOrg = user.organization && !user.organization.includes("TATU")
    ? user.organization
    : "BSTU";

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-title"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width: "min(420px, 100%)" }}
      >
        <button className="modal-close" aria-label="Yopish" onClick={onClose}>
          <Icon name="close" size={18} />
        </button>

        <div className="modal-symbol danger">
          <Icon name="logout" size={22} />
        </div>

        <h2 id="logout-title">{t("shell.logoutTitle")}</h2>
        <p>{t("shell.logoutDesc")}</p>

        <div className="logout-card">
          <div className="logout-avatar">
            {user.photo ? <img src={user.photo} alt={user.name} /> : user.avatar}
          </div>
          <div className="logout-details">
            <div className="logout-name">{user.name}</div>
            <div className="logout-sub">
              <span>{t(`role.${user.role}`)}</span>
              <span aria-hidden="true">•</span>
              <span>{displayOrg}</span>
            </div>
            {user.email && (
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.email}
              </div>
            )}
          </div>
        </div>

        <div className="logout-hint">
          <Icon name="shieldCheck" size={16} />
          <span>{t("shell.logoutSessionHint")}</span>
        </div>

        <div className="logout-actions">
          <button
            ref={cancelBtnRef}
            type="button"
            className="cancel-button"
            style={{ marginTop: 0 }}
            onClick={onClose}
          >
            {t("shell.cancel")}
          </button>
          <button
            type="button"
            className="danger-button"
            onClick={onConfirm}
          >
            <Icon name="logout" size={15} />
            <span>{t("shell.confirmLogout")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
