import { useEffect, useRef, useState } from "react";
import { Icon, GoogleIcon } from "../common/Icons";
import { demoUsers } from "../../data/ontology";
import type { User, Role, DirectionCode } from "../../types";
import { api } from "../../services/api";
import logoImg from "@/assets/logo.png";
import "./auth.css";
import { LanguageSwitcher, useI18n } from "../../i18n";

const HELIX_RUNGS = 14;
const helixIcons = ["code", "database", "cpu", "search", "gitBranch"] as const;

const activityBubbles = [
  { initials: "AS", name: "Azizbek S.", skill: "Backend · L4", size: 46 },
  { initials: "MK", name: "Madina K.", skill: "SQL · L3", size: 38 },
  { initials: "NR", name: "Nigora R.", skill: "ML · L4", size: 42 },
  { initials: "BM", name: "Bobur M.", skill: "Tarmoqlar · L3", size: 34 },
];

// Per-element 3D tilt that follows the pointer while hovered
function Tilt({ className, tip, children }: { className?: string; tip?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--tx", (((e.clientX - r.left) / r.width - 0.5) * 2).toFixed(3));
    el.style.setProperty("--ty", (((e.clientY - r.top) / r.height - 0.5) * 2).toFixed(3));
  };
  const leave = () => {
    ref.current?.style.setProperty("--tx", "0");
    ref.current?.style.setProperty("--ty", "0");
  };
  return (
    <div ref={ref} className={`a3d-tilt ${className || ""}`} data-tip={tip} onPointerMove={move} onPointerLeave={leave}>
      {children}
    </div>
  );
}

const roleOptions: { key: Role; label: "auth.roleStudent" | "auth.roleTeacher" | "auth.roleEmployer"; icon: "student" | "teacher" | "briefcase" }[] = [
  { key: "student", label: "auth.roleStudent", icon: "student" },
  { key: "teacher", label: "auth.roleTeacher", icon: "teacher" },
  { key: "employer", label: "auth.roleEmployer", icon: "briefcase" },
];

const directionOptions: { key: DirectionCode; label: string; hint: string; icon: "code" | "cpu" | "sparkles" }[] = [
  { key: "software", label: "Dasturiy injiniring", hint: "Backend, frontend, DevOps", icon: "code" },
  { key: "computer", label: "Kompyuter injiniringi", hint: "Tarmoqlar, apparat, tizimlar", icon: "cpu" },
  { key: "ai", label: "Sun’iy intellekt", hint: "ML, ma’lumotlar tahlili, NLP", icon: "sparkles" },
];

// Custom listbox replacing the native <select>, whose popup can't be styled
function DirectionSelect({ value, onChange }: { value: DirectionCode; onChange: (v: DirectionCode) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = directionOptions.find((d) => d.key === value) ?? directionOptions[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const openList = () => {
    setActive(Math.max(0, directionOptions.findIndex((d) => d.key === value)));
    setOpen(true);
  };

  const choose = (i: number) => {
    onChange(directionOptions[i].key);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % directionOptions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + directionOptions.length) % directionOptions.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className="a3d-field" ref={rootRef}>
      <span className="a3d-label" id="direction-label">
        Yo‘nalish
      </span>
      <div className={`a3d-select ${open ? "open" : ""}`}>
        <button
          type="button"
          className="a3d-input a3d-select-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby="direction-label"
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={onKeyDown}
        >
          <Icon name="dna" size={17} />
          <span className="a3d-select-value">{current.label}</span>
          <svg className="a3d-select-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {open && (
          <ul className="a3d-select-list" role="listbox" aria-labelledby="direction-label">
            {directionOptions.map((d, i) => (
              <li
                key={d.key}
                role="option"
                aria-selected={d.key === value}
                className={`${i === active ? "active" : ""} ${d.key === value ? "selected" : ""}`}
                onPointerEnter={() => setActive(i)}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
              >
                <span className="a3d-select-icon">
                  <Icon name={d.icon} size={16} />
                </span>
                <span className="a3d-select-text">
                  <strong>{d.label}</strong>
                  <small>{d.hint}</small>
                </span>
                {d.key === value && (
                  <svg className="a3d-select-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function initialsOf(fullName?: string) {
  return fullName
    ? fullName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "TL";
}

// 0–4 score used by the register form's strength meter
function passwordStrength(pw: string) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) score++;
  return Math.max(score, 1);
}


function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="a3d-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="a3d-check-box">
        <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
          <path d="M1.5 4.5L4 7L9.5 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="a3d-check-text">{children}</span>
    </label>
  );
}

function Field({
  label,
  icon,
  type = "text",
  placeholder,
  value,
  onChange,
  reveal,
  onReveal,
  autoComplete,
}: {
  label: string;
  icon: "mail" | "lock" | "user" | "phone";
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  reveal?: boolean;
  onReveal?: () => void;
  autoComplete?: string;
}) {
  const isPassword = type === "password";
  return (
    <label className="a3d-field">
      <span className="a3d-label">{label}</span>
      <span className="a3d-input">
        <Icon name={icon} size={17} />
        <input
          type={isPassword && reveal ? "text" : type}
          placeholder={placeholder}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
        />
        {isPassword && onReveal && (
          <button type="button" className="a3d-eye" onClick={onReveal} aria-label="Parolni ko‘rsatish">
            <Icon name={reveal ? "eyeOff" : "eye"} size={17} />
          </button>
        )}
      </span>
    </label>
  );
}

export default function AuthScreen({
  onLogin,
}: {
  onLogin: (user: User) => void;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [loginInfo, setLoginInfo] = useState("");

  // Register form state
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regRole, setRegRole] = useState<Role>("student");
  const [regDirection, setRegDirection] = useState<DirectionCode>("software");
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [registerError, setRegisterError] = useState("");

  // Mouse parallax: write CSS variables directly to avoid re-rendering the scene
  const handlePointerMove = (e: React.PointerEvent) => {
    const el = sceneRef.current;
    if (!el) return;
    const mx = (e.clientX / window.innerWidth - 0.5) * 2;
    const my = (e.clientY / window.innerHeight - 0.5) * 2;
    el.style.setProperty("--mx", mx.toFixed(3));
    el.style.setProperty("--my", my.toFixed(3));
  };

  // The panel rotates away on its Y axis, swaps faces, then rotates back in
  const [phase, setPhase] = useState<"idle" | "out" | "in">("idle");
  const [pill, setPill] = useState<"login" | "register">("login");
  const switchTab = (next: "login" | "register") => {
    if (next === tab || phase !== "idle") return;
    setLoginError("");
    setLoginInfo("");
    setRegisterError("");
    setPill(next);
    setPhase("out");
    window.setTimeout(() => {
      setTab(next);
      setPhase("in");
      window.setTimeout(() => setPhase("idle"), 420);
    }, 240);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setLoginError("Email yoki telefon raqami hamda parolni kiriting");
      return;
    }

    setLoading(true);
    setLoginError("");

    try {
      // 1. Attempt real backend login via PostgreSQL + JWT
      const res = await api.login(loginIdentifier.trim(), loginPassword.trim());
      if (res && res.mfa_required && res.mfa_token) {
        // Password accepted; ask for the authenticator code (section 13.1)
        setMfaToken(res.mfa_token);
        setMfaCode("");
        return;
      }
      if (res && res.user) {
        onLogin({
          id: res.user.id,
          name: res.user.full_name,
          email: res.user.email,
          phone: res.user.phone || "",
          role: res.user.role as Role,
          direction: (res.user.direction as DirectionCode) || "software",
          organization: (res.user.organization && !res.user.organization.includes("TATU")) ? res.user.organization : "BSTU",
          avatar: initialsOf(res.user.full_name),
          photo: res.user.photo ?? null,
          bio: res.user.bio || "",
        });
        return;
      }
    } catch (err: any) {
      if (err.message && err.message.includes("noto‘g‘ri")) {
        setLoginError(err.message);
        setLoading(false);
        return;
      }
    } finally {
      setLoading(false);
    }

    // Fallback demo matching
    const matched = Object.values(demoUsers).find(
      (u) =>
        u.email.toLowerCase() === loginIdentifier.trim().toLowerCase() ||
        u.name.toLowerCase() === loginIdentifier.trim().toLowerCase()
    );

    if (matched) {
      onLogin(matched);
    } else {
      const customUser: User = {
        id: `usr-${Date.now()}`,
        name: loginIdentifier.includes("@")
          ? loginIdentifier.split("@")[0].toUpperCase()
          : loginIdentifier,
        email: loginIdentifier.includes("@") ? loginIdentifier : `${loginIdentifier}@skilldna.uz`,
        role: "student",
        direction: "software",
        organization: "Foydalanuvchi hisobi",
        avatar: loginIdentifier.slice(0, 2).toUpperCase(),
      };
      onLogin(customUser);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaToken || !mfaCode.trim()) return;
    setLoading(true);
    setLoginError("");
    try {
      const res = await api.verifyMfa(mfaToken, mfaCode.trim());
      onLogin({
        id: res.user.id,
        name: res.user.full_name,
        email: res.user.email,
        phone: res.user.phone || "",
        role: res.user.role as Role,
        direction: (res.user.direction as DirectionCode) || "software",
        organization: res.user.organization || "BSTU",
        avatar: initialsOf(res.user.full_name),
          photo: res.user.photo ?? null,
        bio: res.user.bio || "",
      });
    } catch (err: any) {
      setLoginError(err.message || "Kod noto‘g‘ri");
      if (/muddati tugadi/.test(err.message || "")) setMfaToken(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFirstName.trim() || !regLastName.trim()) {
      setRegisterError("Ism va familiyangizni kiriting");
      return;
    }
    if (!regEmail.trim()) {
      setRegisterError("Email manzilini kiriting");
      return;
    }
    if (!regPassword.trim()) {
      setRegisterError("Parolni kiriting");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegisterError("Kiritilgan parollar bir-biriga mos kelmadi");
      return;
    }

    if (!agreedTerms) {
      setRegisterError("Foydalanish shartlari va Maxfiylik siyosatiga rozilik bildiring");
      return;
    }

    setLoading(true);
    setRegisterError("");

    try {
      const res = await api.register({
        full_name: `${regFirstName.trim()} ${regLastName.trim()}`,
        email: regEmail.trim(),
        password: regPassword.trim(),
        role: regRole,
        phone: regPhone.trim() || undefined,
        direction_code: regDirection,
      });

      if (res && res.user) {
        onLogin({
          id: res.user.id,
          name: res.user.full_name,
          email: res.user.email,
          phone: res.user.phone || regPhone.trim(),
          role: res.user.role as Role,
          direction: regDirection as DirectionCode,
          organization: (res.user.organization && !res.user.organization.includes("TATU")) ? res.user.organization : "BSTU",
          avatar: initialsOf(res.user.full_name),
          photo: res.user.photo ?? null,
          bio: "",
        });
        return;
      }
    } catch (err: any) {
      setRegisterError(err.message || "Ro‘yxatdan o‘tishda xatolik yuz berdi");
      setLoading(false);
      return;
    } finally {
      setLoading(false);
    }

    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: `${regFirstName.trim()} ${regLastName.trim()}`,
      email: regEmail.trim(),
      role: regRole,
      direction: regDirection,
      organization: "BSTU",
      avatar: regFirstName[0].toUpperCase() + regLastName[0].toUpperCase(),
    };
    onLogin(newUser);
  };

  return (
    <div className="a3d" ref={sceneRef} onPointerMove={handlePointerMove}>
      {/* ================= BACKGROUND LAYERS ================= */}
      <div className="a3d-iso-grid" aria-hidden="true" />
      <div className="a3d-aurora" aria-hidden="true">
        <span className="a3d-blob b1" />
        <span className="a3d-blob b2" />
        <span className="a3d-blob b3" />
      </div>
      <div className="a3d-cubes" aria-hidden="true">
        {[0, 1, 2, 3].map((c) => (
          <span className={`a3d-cube c${c}`} key={c}>
            <i className="top" />
            <i className="left" />
            <i className="right" />
          </span>
        ))}
      </div>
      <div className="a3d-particles" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} style={{ "--p": i } as React.CSSProperties} />
        ))}
      </div>

      {/* ================= LEFT: 3D SHOWCASE ================= */}
      <section className="a3d-showcase">
        <header className="a3d-brand">
          <div className="a3d-brand-mark">
            <img src={logoImg} alt="Skill DNA" />
          </div>
          <div>
            <strong>
              SKILL <span>DNA</span>
            </strong>
            <small>Real Skills · Real Opportunities</small>
          </div>
        </header>

        <div className="a3d-stage">
          {/* Isometric pedestal the helix stands on */}
          <div className="a3d-pedestal" aria-hidden="true">
            <span className="ring r1" />
            <span className="ring r2" />
            <span className="ring r3" />
          </div>

          {/* Glowing slate-blue core column */}
          <div className="a3d-core" aria-hidden="true" />

          {/* Translucent DNA double helix; every bead carries a rotating skill icon */}
          <div className="a3d-helix" aria-hidden="true">
            {Array.from({ length: HELIX_RUNGS }, (_, i) => (
              <div className="a3d-rung" key={i} style={{ "--i": i } as React.CSSProperties}>
                <span className="a3d-bar" />
                <span className="a3d-node left">
                  <i>
                    <Icon name={helixIcons[i % helixIcons.length]} size={11} />
                  </i>
                </span>
                <span className="a3d-node right">
                  <i>
                    <Icon name={helixIcons[(i + 2) % helixIcons.length]} size={11} />
                  </i>
                </span>
              </div>
            ))}
          </div>

          {/* Floating 3D blocks */}
          <Tilt className="a3d-float f1" tip="Backend yo‘nalishi bo‘yicha umumiy ball">
            <div className="a3d-block">
              <div className="a3d-ring">
                <svg viewBox="0 0 44 44">
                  <circle cx="22" cy="22" r="18" />
                  <circle cx="22" cy="22" r="18" className="val" />
                </svg>
                <b>87</b>
              </div>
              <div>
                <small>Skill Score</small>
                <strong>Backend · REST API</strong>
              </div>
            </div>
          </Tilt>

          <Tilt className="a3d-float f2" tip="Dalillar AI Viva orqali himoya qilingan">
            <div className="a3d-block compact">
              <span className="a3d-chip ok">
                <Icon name="shieldCheck" size={16} />
              </span>
              <div>
                <strong>{t("auth.cardProve")}</strong>
                <small>{t("auth.cardProveSub")}</small>
              </div>
            </div>
          </Tilt>

          <Tilt className="a3d-float f3" tip="KNOW · DO · ADAPT · DEFEND · PROVE">
            <div className="a3d-block bars">
              <small>{t("auth.cardModel")}</small>
              <div className="a3d-bars">
                {[90, 85, 80, 78, 60].map((v, i) => (
                  <span key={i} style={{ "--h": `${v}%`, "--d": `${i * 0.12}s` } as React.CSSProperties} />
                ))}
              </div>
              <div className="a3d-bar-labels">
                <i>K</i>
                <i>D</i>
                <i>A</i>
                <i>Df</i>
                <i>P</i>
              </div>
            </div>
          </Tilt>

          <Tilt className="a3d-float f4" tip="Open Badges 3.0 raqamli sertifikati">
            <div className="a3d-block compact">
              <span className="a3d-chip level">L4</span>
              <div>
                <strong>{t("auth.cardLevel")}</strong>
                <small>Open Badges 3.0</small>
              </div>
            </div>
          </Tilt>
        </div>

        <div className="a3d-copy">
          <h1>
            <span className="metal">{t("auth.headline1")}</span> <span className="metal emerald">{t("auth.headline2")}</span>
          </h1>
          <p>{t("auth.lead")}</p>

          <div className="a3d-bubbles">
            {activityBubbles.map((b, i) => (
              <span
                key={b.initials}
                className="a3d-bubble"
                data-tip={`${b.name} · ${b.skill}`}
                style={{ "--s": `${b.size}px`, "--b": i } as React.CSSProperties}
              >
                {b.initials}
              </span>
            ))}
            <span className="a3d-bubble count" data-tip="Faol talabalar soni" style={{ "--s": "58px", "--b": 4 } as React.CSSProperties}>
              <b>1 240+</b>
            </span>
            <p>
              {t("auth.activity")} <strong>{t("auth.activityStrong")}</strong>
            </p>
          </div>

          <ul className="a3d-perks">
            <li data-tip="5 qatlamli halollik nazorati">
              <Icon name="shield" size={15} /> {t("auth.perkTrusted")}
            </li>
            <li data-tip="Rezyume emas, real topshiriqlar">
              <Icon name="chart" size={15} /> {t("auth.perkResults")}
            </li>
            <li data-tip="Tasdiqlangan nomzodlar ish beruvchilarga ko‘rinadi">
              <Icon name="lightning" size={15} /> {t("auth.perkFuture")}
            </li>
          </ul>
        </div>
      </section>

      {/* ================= RIGHT: ROTATING 3D HUB ================= */}
      <section className="a3d-panel-wrap">
        <div className="a3d-panel">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <LanguageSwitcher compact />
          </div>
          <div className="a3d-mobile-brand">
            <div className="a3d-brand-mark">
              <img src={logoImg} alt="Skill DNA" />
            </div>
            <strong>
              SKILL <span>DNA</span>
            </strong>
          </div>

          <div className={`a3d-tabs ${pill}`} role="tablist">
            <span className="a3d-tab-pill" />
            <button type="button" role="tab" aria-selected={pill === "login"} onClick={() => switchTab("login")}>
              {t("auth.tabLogin")}
            </button>
            <button type="button" role="tab" aria-selected={pill === "register"} onClick={() => switchTab("register")}>
              {t("auth.tabRegister")}
            </button>
          </div>

          <div className={`a3d-hub-face phase-${phase}`}>
            {tab === "login" && mfaToken ? (
              /* ----- SECOND FACTOR (section 13.1) ----- */
              <>
                <div className="a3d-head">
                  <h2>{t("auth.mfaTitle")}</h2>
                  <p>{t("auth.mfaSub")}</p>
                </div>
                <form onSubmit={handleMfaSubmit} className="a3d-form">
                  <label className="a3d-field">
                    <span className="a3d-label">{t("auth.mfaCode")}</span>
                    <span className="a3d-input">
                      <Icon name="shieldCheck" size={17} />
                      <input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
                        placeholder="123 456"
                        value={mfaCode}
                        onChange={(e) => {
                          setMfaCode(e.target.value);
                          setLoginError("");
                        }}
                      />
                    </span>
                  </label>
                  {loginError && <div className="a3d-alert error">{loginError}</div>}
                  <button type="submit" className="a3d-submit" disabled={loading || !mfaCode.trim()}>
                    <span className="a3d-core-orb" aria-hidden="true" />
                    <span>{loading ? t("auth.checking") : t("auth.mfaSubmit")}</span>
                    {!loading && <Icon name="arrow" size={17} />}
                  </button>
                  <p className="a3d-switch">
                    <button type="button" onClick={() => { setMfaToken(null); setLoginError(""); }}>
                      {t("auth.mfaOther")}
                    </button>
                  </p>
                </form>
              </>
            ) : tab === "login" ? (
              /* ----- LOGIN FORM ----- */
              <>
                <div className="a3d-head">
                  <h2>{t("auth.welcome")}</h2>
                  <p>{t("auth.welcomeSub")}</p>
                </div>

                <form onSubmit={handleLoginSubmit} className="a3d-form">
                  <Field
                    label={t("auth.identifier")}
                    icon="mail"
                    placeholder={t("auth.identifierPh")}
                    value={loginIdentifier}
                    autoComplete="username"
                    onChange={(v) => {
                      setLoginIdentifier(v);
                      setLoginError("");
                    }}
                  />
                  <Field
                    label={t("auth.password")}
                    icon="lock"
                    type="password"
                    placeholder={t("auth.passwordPh")}
                    value={loginPassword}
                    autoComplete="current-password"
                    reveal={showLoginPassword}
                    onReveal={() => setShowLoginPassword(!showLoginPassword)}
                    onChange={(v) => {
                      setLoginPassword(v);
                      setLoginError("");
                    }}
                  />

                  <div className="a3d-aux">
                    <Checkbox checked={rememberMe} onChange={setRememberMe}>
                      {t("auth.remember")}
                    </Checkbox>
                    <button
                      type="button"
                      className="a3d-link"
                      onClick={() => setLoginInfo(t("auth.forgotSent"))}
                    >
                      {t("auth.forgot")}
                    </button>
                  </div>

                  {loginError && <div className="a3d-alert error">{loginError}</div>}
                  {loginInfo && !loginError && <div className="a3d-alert info">{loginInfo}</div>}

                  <button type="submit" className="a3d-submit" disabled={loading}>
                    <span className="a3d-core-orb" aria-hidden="true" />
                    <span>{loading ? t("auth.checking") : t("auth.submitLogin")}</span>
                    {!loading && <Icon name="arrow" size={17} />}
                  </button>

                  <div className="a3d-divider">
                    <span>{t("auth.or")}</span>
                  </div>

                  <button type="button" className="a3d-google" onClick={() => onLogin(demoUsers.student)}>
                    <GoogleIcon size={18} />
                    <span>{t("auth.google")}</span>
                  </button>

                  <p className="a3d-switch">
                    {t("auth.noAccount")}{" "}
                    <button type="button" onClick={() => switchTab("register")}>
                      {t("auth.goRegister")}
                    </button>
                  </p>
                </form>
              </>
            ) : (
              /* ----- REGISTER FORM ----- */
              <>
                <div className="a3d-head">
                  <h2>{t("auth.createTitle")}</h2>
                  <p>{t("auth.createSub")}</p>
                </div>

                <form onSubmit={handleRegisterSubmit} className="a3d-form">
                  <div className="a3d-roles">
                    {roleOptions.map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        className={regRole === r.key ? "active" : ""}
                        onClick={() => setRegRole(r.key)}
                      >
                        <Icon name={r.icon} size={18} />
                        <span>{t(r.label)}</span>
                      </button>
                    ))}
                  </div>

                  <div className="a3d-row">
                    <Field label={t("auth.firstName")} icon="user" placeholder={t("auth.firstNamePh")} value={regFirstName} onChange={setRegFirstName} autoComplete="given-name" />
                    <Field label={t("auth.lastName")} icon="user" placeholder={t("auth.lastNamePh")} value={regLastName} onChange={setRegLastName} autoComplete="family-name" />
                  </div>

                  <div className="a3d-row">
                    <Field label={t("auth.email")} icon="mail" type="email" placeholder="example@mail.com" value={regEmail} onChange={setRegEmail} autoComplete="email" />
                    <Field label={t("auth.phone")} icon="phone" placeholder="+998 90 123 45 67" value={regPhone} onChange={setRegPhone} autoComplete="tel" />
                  </div>

                  {regRole === "student" && (
                    <DirectionSelect value={regDirection} onChange={setRegDirection} />
                  )}

                  <div className="a3d-row">
                    <Field
                      label={t("auth.password")}
                      icon="lock"
                      type="password"
                      placeholder={t("auth.password")}
                      value={regPassword}
                      autoComplete="new-password"
                      reveal={showRegPassword}
                      onReveal={() => setShowRegPassword(!showRegPassword)}
                      onChange={setRegPassword}
                    />
                    <Field
                      label={t("auth.confirm")}
                      icon="lock"
                      type="password"
                      placeholder={t("auth.confirmPh")}
                      value={regConfirmPassword}
                      autoComplete="new-password"
                      reveal={showRegConfirmPassword}
                      onReveal={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                      onChange={setRegConfirmPassword}
                    />
                  </div>

                  {regPassword && (
                    <div className={`a3d-strength s${passwordStrength(regPassword)}`}>
                      <div>
                        {[1, 2, 3, 4].map((n) => (
                          <i key={n} />
                        ))}
                      </div>
                      <span>{t(`auth.strength.${passwordStrength(regPassword)}` as "auth.strength.1")}</span>
                    </div>
                  )}

                  <Checkbox checked={agreedTerms} onChange={setAgreedTerms}>
                    <a href="#terms" onClick={(e) => e.preventDefault()}>
                      {t("auth.terms")}
                    </a>
                    {t("auth.and")}
                    <a href="#privacy" onClick={(e) => e.preventDefault()}>
                      {t("auth.privacy")}
                    </a>
                    {t("auth.agree")}
                  </Checkbox>

                  {registerError && <div className="a3d-alert error">{registerError}</div>}

                  <button type="submit" className="a3d-submit" disabled={loading}>
                    <span className="a3d-core-orb" aria-hidden="true" />
                    <span>{loading ? t("auth.creating") : t("auth.submitRegister")}</span>
                    {!loading && <Icon name="arrow" size={17} />}
                  </button>

                  <button type="button" className="a3d-google" onClick={() => onLogin(demoUsers.student)}>
                    <GoogleIcon size={18} />
                    <span>{t("auth.googleRegister")}</span>
                  </button>

                  <p className="a3d-switch">
                    {t("auth.haveAccount")}{" "}
                    <button type="button" onClick={() => switchTab("login")}>
                      {t("auth.tabLogin")}
                    </button>
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
