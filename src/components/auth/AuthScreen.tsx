import { useState } from "react";
import { Icon, GoogleIcon } from "../common/Icons";
import { demoUsers } from "../../data/ontology";
import type { User, Role, DirectionCode } from "../../types";
import { api } from "../../services/api";

export default function AuthScreen({
  onLogin,
}: {
  onLogin: (user: User) => void;
}) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState("");

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
      if (res && res.user) {
        const initials = res.user.full_name
          ? res.user.full_name
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()
          : "TL";
        onLogin({
          id: res.user.id,
          name: res.user.full_name,
          email: res.user.email,
          phone: res.user.phone || "",
          role: res.user.role as Role,
          direction: (res.user.direction as DirectionCode) || "software",
          organization: (res.user.organization && !res.user.organization.includes("TATU")) ? res.user.organization : "BSTU",
          avatar: initials,
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
        const initials = res.user.full_name
          ? res.user.full_name
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()
          : "TL";
        onLogin({
          id: res.user.id,
          name: res.user.full_name,
          email: res.user.email,
          phone: res.user.phone || regPhone.trim(),
          role: res.user.role as Role,
          direction: regDirection as DirectionCode,
          organization: (res.user.organization && !res.user.organization.includes("TATU")) ? res.user.organization : "BSTU",
          avatar: initials,
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
    <div className="auth-page-wrapper">
      <div className="auth-modal-card">
        {/* ================= LEFT BANNER ================= */}
        <div className="auth-left-banner">
          {/* Background image overlay */}
          <div
            className="auth-bg-art"
            style={{
              backgroundImage: `url('${(import.meta.env.BASE_URL || "/").replace(/\/{2,}/g, "/")}auth-bg.png')`,
            }}
          />

          <div className="auth-left-content">
            {/* Logo */}
            <div className="auth-logo-row">
              <div className="auth-logo-badge">
                <img
                  src={`${(import.meta.env.BASE_URL || "/").replace(/\/{2,}/g, "/")}logo.png`}
                  alt="Skill DNA"
                  className="auth-logo-img"
                />
              </div>
              <div className="auth-logo-text-block">
                <div className="auth-logo-text">
                  SKILL <span>DNA</span>
                </div>
                <div className="auth-logo-sub">
                  REAL SKILLS · REAL OPPORTUNITIES
                </div>
              </div>
            </div>

            {/* Main Headline */}
            <div className="auth-headline-block">
              <h1>
                O‘z salohiyatingizni <br />
                <span className="accent-teal">oching</span>
              </h1>
              <p>
                Bilimingizni sinang, mahoratingizni rivojlantiring va kelajagingizni quring.
              </p>
            </div>

            {/* Spacer to let 3D illustration shine */}
            <div className="auth-art-spacer" />

            {/* Bottom 3 Badges */}
            <div className="auth-bottom-badges">
              <div className="auth-badge-col">
                <div className="badge-icon-box">
                  <Icon name="shield" size={17} />
                </div>
                <span>Ishonchli platforma</span>
              </div>
              <div className="auth-badge-col">
                <div className="badge-icon-box">
                  <Icon name="chart" size={17} />
                </div>
                <span>Real natijalar</span>
              </div>
              <div className="auth-badge-col">
                <div className="badge-icon-box">
                  <Icon name="lightning" size={17} />
                </div>
                <span>Kelajakka yo‘l</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= RIGHT FORM ================= */}
        <div className="auth-right-form">

          {tab === "login" ? (
            /* ----- LOGIN FORM ----- */
            <div className="form-content-wrap">
              <div className="form-header">
                <h2>Tizimga kirish</h2>
                <p>Hisobingizga kiring va davom eting</p>
              </div>

              <form onSubmit={handleLoginSubmit} className="auth-form">
                {/* Identifier */}
                <div className="input-group">
                  <label>Email yoki telefon raqami</label>
                  <div className="input-field">
                    <span className="field-icon">
                      <Icon name="mail" size={18} />
                    </span>
                    <input
                      type="text"
                      placeholder="example@mail.com yoki +998 90 123 45 67"
                      value={loginIdentifier}
                      onChange={(e) => {
                        setLoginIdentifier(e.target.value);
                        setLoginError("");
                      }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="input-group">
                  <label>Parol</label>
                  <div className="input-field">
                    <span className="field-icon">
                      <Icon name="lock" size={18} />
                    </span>
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      placeholder="Parolingizni kiriting"
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        setLoginError("");
                      }}
                    />
                    <button
                      type="button"
                      className="eye-toggle"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      aria-label="Parolni ko‘rsatish"
                    >
                      <Icon name={showLoginPassword ? "eyeOff" : "eye"} size={18} />
                    </button>
                  </div>
                </div>

                {/* Remember & Forgot */}
                <div className="form-aux-row">
                  <label className="custom-checkbox">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span className="checkbox-box">
                      {rememberMe && (
                        <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                          <path
                            d="M1.5 4.5L4 7L9.5 1.5"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="checkbox-text">Meni eslab qolish</span>
                  </label>
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault();
                      alert("Parolni tiklash havolasi emailingizga yuborildi.");
                    }}
                    className="forgot-link"
                  >
                    Parolni unutdingizmi?
                  </a>
                </div>

                {loginError && <div className="form-error-alert">{loginError}</div>}

                {/* Submit button */}
                <button type="submit" className="auth-submit-btn">
                  Kirish <span className="btn-arrow">→</span>
                </button>

                {/* Divider */}
                <div className="auth-divider">
                  <span>Yoki</span>
                </div>

                {/* Google Login */}
                <button
                  type="button"
                  className="google-auth-btn"
                  onClick={() => onLogin(demoUsers.student)}
                >
                  <GoogleIcon size={19} />
                  <span>Google orqali kirish</span>
                </button>

                {/* Switch link */}
                <div className="switch-auth-link">
                  Hisobingiz yo‘qmi?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setTab("register");
                      setLoginError("");
                    }}
                  >
                    Ro‘yxatdan o‘ting
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* ----- REGISTER FORM ----- */
            <div className="form-content-wrap">
              <div className="form-header">
                <h2>Ro‘yxatdan o‘tish</h2>
                <p>Yangi hisob oching va imkoniyatlar dunyosiga qadam qo‘ying</p>
              </div>

              <form onSubmit={handleRegisterSubmit} className="auth-form register-form">
                {/* First Name & Last Name */}
                <div className="form-row-2col">
                  <div className="input-group">
                    <label>Ism</label>
                    <div className="input-field">
                      <span className="field-icon">
                        <Icon name="user" size={18} />
                      </span>
                      <input
                        type="text"
                        placeholder="Ismingizni kiriting"
                        value={regFirstName}
                        onChange={(e) => setRegFirstName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Familiya</label>
                    <div className="input-field">
                      <span className="field-icon">
                        <Icon name="user" size={18} />
                      </span>
                      <input
                        type="text"
                        placeholder="Familiyangizni kiriting"
                        value={regLastName}
                        onChange={(e) => setRegLastName(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div className="input-group">
                  <label>Email</label>
                  <div className="input-field">
                    <span className="field-icon">
                      <Icon name="mail" size={18} />
                    </span>
                    <input
                      type="email"
                      placeholder="example@mail.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="input-group">
                  <label>Telefon raqam</label>
                  <div className="input-field">
                    <span className="field-icon">
                      <Icon name="phone" size={18} />
                    </span>
                    <input
                      type="text"
                      placeholder="+998 90 123 45 67"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                    />
                  </div>
                </div>

                {/* Password & Confirm */}
                <div className="input-group">
                  <label>Parol</label>
                  <div className="input-field">
                    <span className="field-icon">
                      <Icon name="lock" size={18} />
                    </span>
                    <input
                      type={showRegPassword ? "text" : "password"}
                      placeholder="Parolni kiriting"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="eye-toggle"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      aria-label="Parolni ko‘rsatish"
                    >
                      <Icon name={showRegPassword ? "eyeOff" : "eye"} size={18} />
                    </button>
                  </div>
                </div>

                <div className="input-group">
                  <label>Parolni tasdiqlang</label>
                  <div className="input-field">
                    <span className="field-icon">
                      <Icon name="lock" size={18} />
                    </span>
                    <input
                      type={showRegConfirmPassword ? "text" : "password"}
                      placeholder="Parolni qayta kiriting"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="eye-toggle"
                      onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                      aria-label="Parolni tasdiqlashni ko‘rsatish"
                    >
                      <Icon name={showRegConfirmPassword ? "eyeOff" : "eye"} size={18} />
                    </button>
                  </div>
                </div>

                {/* Agreement */}
                <div className="agreement-check-row">
                  <label className="custom-checkbox agreement-checkbox">
                    <input
                      type="checkbox"
                      checked={agreedTerms}
                      onChange={(e) => setAgreedTerms(e.target.checked)}
                    />
                    <span className="checkbox-box">
                      {agreedTerms && (
                        <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                          <path
                            d="M1.5 4.5L4 7L9.5 1.5"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="checkbox-text agreement-text">
                      <a href="#terms" onClick={(e) => e.preventDefault()}>
                        Foydalanish shartlari
                      </a>
                      {" va "}
                      <a href="#privacy" onClick={(e) => e.preventDefault()}>
                        Maxfiylik siyosati
                      </a>
                      {" bilan tanishdim va roziman"}
                    </span>
                  </label>
                </div>

                {registerError && <div className="form-error-alert">{registerError}</div>}

                {/* Submit button */}
                <button type="submit" className="auth-submit-btn">
                  Ro‘yxatdan o‘tish <span className="btn-arrow">→</span>
                </button>

                {/* Divider */}
                <div className="auth-divider">
                  <span>Yoki</span>
                </div>

                {/* Google Register */}
                <button
                  type="button"
                  className="google-auth-btn"
                  onClick={() => onLogin(demoUsers.student)}
                >
                  <GoogleIcon size={19} />
                  <span>Google orqali ro‘yxatdan o‘tish</span>
                </button>

                {/* Switch link */}
                <div className="switch-auth-link">
                  Hisobingiz bormi?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setTab("login");
                      setRegisterError("");
                    }}
                  >
                    Kirish
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Floating Demo Bar below the card */}
      <div className="auth-demo-footer">
        <span>Tezkor demo hisoblar:</span>
        <button type="button" onClick={() => onLogin(demoUsers.student)} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <Icon name="student" size={14} /> Talaba
        </button>
        <button type="button" onClick={() => onLogin(demoUsers.teacher)} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <Icon name="teacher" size={14} /> O‘qituvchi
        </button>
        <button type="button" onClick={() => onLogin(demoUsers.employer)} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <Icon name="briefcase" size={14} /> Ish beruvchi
        </button>
        <button type="button" onClick={() => onLogin(demoUsers.university)} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <Icon name="university" size={14} /> Rektorat
        </button>
        <button type="button" onClick={() => onLogin(demoUsers.moderator)} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <Icon name="shieldCheck" size={14} /> Moderator
        </button>
      </div>
    </div>
  );
}
