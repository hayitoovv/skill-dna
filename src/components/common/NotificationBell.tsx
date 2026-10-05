import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icons";
import type { IconName } from "./Icons";
import { api, hasSession } from "../../services/api";

interface Notice {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

const POLL_MS = 30_000;
/** Fired on window when a new notification arrives, so open pages (invites lists) can refresh themselves. */
export const NOTIFICATIONS_EVENT = "skilldna:notifications";

const KIND_ICON: Record<string, IconName> = {
  invite_received: "briefcase",
  invite_withdrawn: "briefcase",
  invite_answered: "userCheck",
  evidence_verified: "checkCircle",
  evidence_rejected: "alert",
  appeal_resolved: "shield",
  viva_graded: "sparkles",
};

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "hozirgina";
  if (s < 3600) return `${Math.floor(s / 60)} daqiqa oldin`;
  if (s < 86400) return `${Math.floor(s / 3600)} soat oldin`;
  return `${Math.floor(s / 86400)} kun oldin`;
}

interface NotificationBellProps {
  label: string;
  /** Opens the in-app target of a notification, e.g. "student:career" or "employer:invites". */
  onNavigate: (link: string) => void;
}

export default function NotificationBell({ label, onNavigate }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const newestId = useRef<string | null>(null);

  const load = () => {
    if (!hasSession()) return;
    api
      .getNotifications()
      .then((data) => {
        const list = data.items as Notice[];
        const newest = list[0]?.id ?? null;
        if (newestId.current !== null && newest !== newestId.current) window.dispatchEvent(new Event(NOTIFICATIONS_EVENT));
        newestId.current = newest ?? "";
        setItems(list);
        setUnread(data.unread);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  };

  // Poll while the tab is visible, and refresh as soon as the user comes back to it
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) load();
    setOpen((v) => !v);
  };

  const openItem = (n: Notice) => {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      api.readNotification(n.id).catch(() => {});
    }
    setOpen(false);
    if (n.link) onNavigate(n.link);
  };

  const readAll = () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnread(0);
    api.readAllNotifications().catch(() => {});
  };

  return (
    <div className="notif-root" ref={rootRef}>
      <button
        className="icon-button"
        aria-label={unread ? `${label}: ${unread} ta yangi` : label}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
      >
        <Icon name="bell" size={17} />
        {unread > 0 && <span className="notif-count">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label={label}>
          <div className="notif-head">
            <strong>Bildirishnomalar</strong>
            {unread > 0 && (
              <button type="button" className="notif-readall" onClick={readAll}>
                Barchasini o‘qilgan deb belgilash
              </button>
            )}
          </div>
          <div className="notif-list">
            {!loaded ? (
              <div className="notif-empty">Yuklanmoqda…</div>
            ) : items.length === 0 ? (
              <div className="notif-empty">
                <Icon name="bell" size={22} />
                <div>Hozircha bildirishnoma yo‘q</div>
              </div>
            ) : (
              items.map((n) => (
                <button key={n.id} type="button" className={`notif-item ${n.read ? "" : "is-unread"}`} onClick={() => openItem(n)}>
                  <span className="notif-icon">
                    <Icon name={KIND_ICON[n.kind] ?? "bell"} size={16} />
                  </span>
                  <span className="notif-text">
                    <span className="notif-title">{n.title}</span>
                    {n.body && <span className="notif-body">{n.body}</span>}
                    <span className="notif-time">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.read && <span className="notif-unread-dot" aria-hidden="true" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
