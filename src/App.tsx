import { useState, useEffect } from "react";
import { Icon, Logo } from "./components/common/Icons";
import StudentView, { type PageKey } from "./components/student/StudentView";
import TeacherPortal from "./components/teacher/TeacherPortal";
import EmployerPortal from "./components/employer/EmployerPortal";
import UniversityDashboard from "./components/university/UniversityDashboard";
import ModeratorQueue from "./components/moderator/ModeratorQueue";
import AuthScreen from "./components/auth/AuthScreen";
import AssessmentModal from "./components/student/AssessmentModal";
import type { DirectionCode, Role, User } from "./types";
import { demoUsers } from "./data/ontology";
import { api } from "./services/api";

const roleLabels: Record<Role, { title: string; badge: string; icon: any }> = {
  student: { title: "Talaba kabineti", badge: "STUDENT", icon: "dna" },
  teacher: { title: "O‘qituvchi paneli", badge: "TEACHER", icon: "users" },
  employer: { title: "Ish beruvchi portali", badge: "EMPLOYER", icon: "briefcase" },
  university: { title: "Universitet tahlili", badge: "UNIVERSITY", icon: "building" },
  moderator: { title: "Moderatsiya (Integrity)", badge: "MODERATOR", icon: "shield" },
};

const directionLabels: Record<DirectionCode, string> = {
  software: "Dasturiy injiniring",
  computer: "Kompyuter injiniringi",
  ai: "Sun’iy intellekt",
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem("skill_dna_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeRole, setActiveRole] = useState<Role>(() => {
    try {
      const savedActive = localStorage.getItem("skill_dna_active_role");
      if (savedActive && savedActive.toLowerCase() in roleLabels) {
        return savedActive.toLowerCase() as Role;
      }
      const saved = localStorage.getItem("skill_dna_user");
      if (saved) {
        const u = JSON.parse(saved);
        if (u.role && u.role.toLowerCase() in roleLabels) {
          return u.role.toLowerCase() as Role;
        }
      }
    } catch {}
    return "student";
  });

  const [roleSwitchFeedback, setRoleSwitchFeedback] = useState<string | null>(null);

  const [direction, setDirection] = useState<DirectionCode>(() => {
    try {
      const saved = localStorage.getItem("skill_dna_direction");
      if (saved && ["software", "computer", "ai"].includes(saved)) {
        return saved as DirectionCode;
      }
    } catch {}
    return "software";
  });

  const [activePage, setActivePage] = useState<PageKey>(() => {
    try {
      const saved = localStorage.getItem("skill_dna_page");
      if (
        saved &&
        ["dashboard", "dna", "tasks", "career", "certificates", "settings"].includes(saved)
      ) {
        return saved as PageKey;
      }
    } catch {}
    return "dashboard";
  });

  const [univTab, setUnivTab] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("skill_dna_univ_tab");
      if (saved && saved !== "workflow") return saved;
    } catch {}
    return "dashboard";
  });

  const handleUnivTabChange = (tab: string) => {
    setUnivTab(tab);
    try {
      localStorage.setItem("skill_dna_univ_tab", tab);
    } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const [moderatorTab, setModeratorTab] = useState<"flags" | "transcripts" | "rules">(() => {
    try {
      const saved = localStorage.getItem("skill_dna_moderator_tab");
      if (saved && ["flags", "transcripts", "rules"].includes(saved)) {
        return saved as "flags" | "transcripts" | "rules";
      }
    } catch {}
    return "flags";
  });

  const handleModeratorTabChange = (tab: "flags" | "transcripts" | "rules") => {
    setModeratorTab(tab);
    try {
      localStorage.setItem("skill_dna_moderator_tab", tab);
    } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [assessmentScoreVersion, setAssessmentScoreVersion] = useState(0);

  // Sync profile data from backend PostgreSQL on load or when currentUser changes
  useEffect(() => {
    const saved = localStorage.getItem("skill_dna_user");
    let parsedUser: User | null = null;
    try {
      parsedUser = saved ? JSON.parse(saved) : null;
    } catch {}

    const uid = parsedUser?.id || parsedUser?.email;
    if (uid) {
      api.getMe(uid)
        .then((me) => {
          if (me && me.id && me.full_name) {
            // Check if user previously selected an explicit active role
            const savedActiveRole = localStorage.getItem("skill_dna_active_role") as Role | null;
            const validActive = (savedActiveRole && savedActiveRole.toLowerCase() in roleLabels)
              ? (savedActiveRole.toLowerCase() as Role)
              : null;

            // Role returned by backend database
            const backendRole = (me.role && me.role.toLowerCase() in roleLabels)
              ? (me.role.toLowerCase() as Role)
              : null;

            // Prioritize explicitly selected active role, then backend role, then parsed role
            const effectiveRole: Role = validActive || backendRole || (parsedUser?.role as Role) || "student";

            const syncedUser: User = {
              id: me.id,
              name: me.full_name,
              email: me.email,
              phone: me.phone || "",
              role: effectiveRole,
              direction: (me.direction_code as DirectionCode) || parsedUser?.direction || "software",
              organization: (me.organization && !me.organization.includes("TATU")) ? me.organization : "BSTU",
              avatar: me.avatar || (me.full_name ? me.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() : "TL"),
              bio: me.bio || parsedUser?.bio,
            };
            setCurrentUser(syncedUser);
            setActiveRole(effectiveRole);
            localStorage.setItem("skill_dna_user", JSON.stringify(syncedUser));
            localStorage.setItem("skill_dna_active_role", effectiveRole);

            if (me.direction_code) {
              setDirection(me.direction_code as DirectionCode);
            }
          }
        })
        .catch((err) => {
          console.warn("[Auth Sync] Profilni serverdan olishda xatolik:", err);
        });
    }
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    const userRole = (user.role && user.role.toLowerCase() in roleLabels)
      ? (user.role.toLowerCase() as Role)
      : "student";
    setActiveRole(userRole);
    try {
      localStorage.setItem("skill_dna_user", JSON.stringify(user));
      localStorage.setItem("skill_dna_active_role", userRole);
    } catch {}
    if (user.direction) {
      setDirection(user.direction);
      try {
        localStorage.setItem("skill_dna_direction", user.direction);
      } catch {}
    }
  };

  const handleLogout = () => {
    if (window.confirm("Hisobingizdan chiqishni tasdiqlaysizmi?")) {
      setCurrentUser(null);
      setActiveRole("student");
      try {
        localStorage.removeItem("skill_dna_user");
        localStorage.removeItem("skill_dna_token");
        localStorage.removeItem("skill_dna_page");
        localStorage.removeItem("skill_dna_active_role");
      } catch {}
    }
  };

  // If user is not logged in, show AuthScreen
  if (!currentUser) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  const role: Role = (activeRole in roleLabels)
    ? activeRole
    : (currentUser?.role && currentUser.role.toLowerCase() in roleLabels)
      ? (currentUser.role.toLowerCase() as Role)
      : "student";
  const currentRoleInfo = roleLabels[role] || roleLabels.student;

  const handleRoleChange = async (newRole: Role) => {
    if (!newRole || !(newRole in roleLabels)) return;

    setActiveRole(newRole);
    localStorage.setItem("skill_dna_active_role", newRole);

    if (currentUser) {
      const updated: User = {
        ...currentUser,
        role: newRole,
      };
      setCurrentUser(updated);
      try {
        localStorage.setItem("skill_dna_user", JSON.stringify(updated));
      } catch {}

      // Informative security feedback toast
      setRoleSwitchFeedback(`RBAC Xavfsizligi: Faol portal "${roleLabels[newRole].title}" ga o‘zgartirildi va sessiya sinxronlandi.`);
      setTimeout(() => setRoleSwitchFeedback(null), 4000);

      // Persist role update to backend PostgreSQL via authenticated RBAC endpoint
      try {
        await api.updateMe(currentUser.id, { role: newRole });
      } catch (err: any) {
        console.warn("[RBAC] Rolni serverda sinxronlashda xatolik:", err?.message || err);
      }
    }
  };

  const handleDirectionChange = (newDir: DirectionCode) => {
    setDirection(newDir);
    try {
      localStorage.setItem("skill_dna_direction", newDir);
    } catch {}
  };

  const goTo = (page: PageKey) => {
    setActivePage(page);
    try {
      localStorage.setItem("skill_dna_page", page);
    } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const displayOrg = (currentUser.organization && !currentUser.organization.includes("TATU"))
    ? currentUser.organization
    : "BSTU";

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <Logo showTagline={true} />

        {/* Role Selector Card */}
        <div
          style={{
            margin: "24px 0 12px",
            padding: "10px",
            background: "rgba(255, 255, 255, 0.05)",
            borderRadius: "10px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", marginBottom: "6px" }}>
            FAOL ROL (PORTAL)
          </div>
          <select
            value={role}
            onChange={(e) => handleRoleChange(e.target.value as Role)}
            style={{
              width: "100%",
              padding: "8px 11px",
              borderRadius: "7px",
              background: "#1e293b",
              color: "#e2e8f0",
              border: "1px solid #334155",
              fontSize: "13.5px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <option value="student">Talaba (Student)</option>
            <option value="teacher">O‘qituvchi (Teacher)</option>
            <option value="employer">Ish beruvchi (Employer)</option>
            <option value="university">Universitet Dekanati (Admin)</option>
            <option value="moderator">Moderator (Integrity)</option>
          </select>
        </div>

        {/* Navigation based on Role */}
        {role === "student" && (
          <nav className="main-nav" aria-label="Asosiy navigatsiya" style={{ marginTop: "12px" }}>
            <div className="nav-label">TALABA PANELI</div>
            <button
              className={`nav-item ${activePage === "dashboard" ? "active" : ""}`}
              onClick={() => goTo("dashboard")}
            >
              <Icon name="grid" /> Boshqaruv paneli
            </button>
            <button className={`nav-item ${activePage === "dna" ? "active" : ""}`} onClick={() => goTo("dna")}>
              <Icon name="dna" /> Mening Skill DNA’m
            </button>
            <button className={`nav-item ${activePage === "tasks" ? "active" : ""}`} onClick={() => goTo("tasks")}>
              <Icon name="file" /> Topshiriqlar <span className="nav-pill">5</span>
            </button>
            <button className={`nav-item ${activePage === "career" ? "active" : ""}`} onClick={() => goTo("career")}>
              <Icon name="briefcase" /> Karyera yo‘li
            </button>
            <div className="nav-label section">PROFIL & SOZLAMALAR</div>
            <button
              className={`nav-item ${activePage === "certificates" ? "active" : ""}`}
              onClick={() => goTo("certificates")}
            >
              <Icon name="award" /> Sertifikatlar (OB 3.0)
            </button>
            <button
              className={`nav-item ${activePage === "settings" ? "active" : ""}`}
              onClick={() => goTo("settings")}
            >
              <Icon name="settings" /> Sozlamalar & Consent
            </button>
          </nav>
        )}

        {role === "teacher" && (
          <nav className="main-nav" aria-label="O‘qituvchi navigatsiyasi" style={{ marginTop: "12px" }}>
            <div className="nav-label">O‘QITUVCHI MODULLARI</div>
            <button className="nav-item active">
              <Icon name="users" /> Guruh Skill Heatmap
            </button>
            <button className="nav-item">
              <Icon name="check" /> PROVE Tasdiqlash navbati
            </button>
            <button className="nav-item">
              <Icon name="code" /> Remedial Generator
            </button>
            <button className="nav-item">
              <Icon name="file" /> AI Viva natijalari
            </button>
          </nav>
        )}

        {role === "employer" && (
          <nav className="main-nav" aria-label="Ish beruvchi navigatsiyasi" style={{ marginTop: "12px" }}>
            <div className="nav-label">ISH BERUVCHI</div>
            <button className="nav-item active">
              <Icon name="search" /> Nomzodlar qidiruvi
            </button>
            <button className="nav-item">
              <Icon name="shield" /> Verified Candidates
            </button>
            <button className="nav-item">
              <Icon name="briefcase" /> Takliflar jurnali
            </button>
          </nav>
        )}

        {role === "university" && (
          <nav className="main-nav" aria-label="Universitet navigatsiyasi" style={{ marginTop: "12px" }}>
            <div className="nav-label">ASOSIY DASHBOARD</div>
            <button
              className={`nav-item ${univTab === "dashboard" || univTab === "analytics" ? "active" : ""}`}
              onClick={() => handleUnivTabChange("dashboard")}
            >
              <Icon name="grid" /> Boshqaruv paneli
            </button>

            <div className="nav-label section">AKADEMIK BOSHQARUV</div>
            <button
              className={`nav-item ${univTab === "groups" ? "active" : ""}`}
              onClick={() => handleUnivTabChange("groups")}
            >
              <Icon name="users" /> Guruhlar & Biriktirish <span className="nav-pill">4</span>
            </button>
            <button
              className={`nav-item ${univTab === "teachers" ? "active" : ""}`}
              onClick={() => handleUnivTabChange("teachers")}
            >
              <Icon name="user" /> O‘qituvchilar bazasi <span className="nav-pill">4</span>
            </button>
            <button
              className={`nav-item ${univTab === "students" ? "active" : ""}`}
              onClick={() => handleUnivTabChange("students")}
            >
              <Icon name="dna" /> Talabalar kontingenti <span className="nav-pill">6</span>
            </button>
            <button
              className={`nav-item ${univTab === "workflow" ? "active" : ""}`}
              onClick={() => handleUnivTabChange("workflow")}
            >
              <Icon name="lightning" /> Tuzilma & Ketma-ketlik
            </button>

            <div className="nav-label section">AKADEMIK TAHLIL</div>
            <button
              className={`nav-item ${univTab === "curriculum" ? "active" : ""}`}
              onClick={() => handleUnivTabChange("curriculum")}
            >
              <Icon name="alert" /> O‘quv dasturi oq dog‘lari
            </button>
            <button
              className={`nav-item ${univTab === "levels" ? "active" : ""}`}
              onClick={() => handleUnivTabChange("levels")}
            >
              <Icon name="award" /> Malaka taqsimoti (L1–L5)
            </button>
          </nav>
        )}

        {role === "moderator" && (
          <nav className="main-nav" aria-label="Moderator navigatsiyasi" style={{ marginTop: "12px" }}>
            <div className="nav-label">HALOLLIK NAZORATI</div>
            <button
              className={`nav-item ${moderatorTab === "flags" ? "active" : ""}`}
              onClick={() => handleModeratorTabChange("flags")}
            >
              <Icon name="shield" /> Bayroqlar navbati (Flags)
            </button>
            <button
              className={`nav-item ${moderatorTab === "transcripts" ? "active" : ""}`}
              onClick={() => handleModeratorTabChange("transcripts")}
            >
              <Icon name="file" /> Viva Transkript tekshiruvi
            </button>
            <button
              className={`nav-item ${moderatorTab === "rules" ? "active" : ""}`}
              onClick={() => handleModeratorTabChange("rules")}
            >
              <Icon name="settings" /> Ontologiya & Rubrikalar
            </button>
          </nav>
        )}

        {/* Current user mini info with Logout button */}
        <div
          className="user-mini"
          onClick={() => goTo("settings")}
          style={{ cursor: "pointer" }}
          title="Profil va sozlamalarga o‘tish"
        >
          <div className="avatar">{currentUser.avatar}</div>
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
            <strong style={{ whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", display: "block" }}>
              {currentUser.name}
            </strong>
            <span style={{ whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", display: "block" }}>
              {displayOrg}
            </span>
          </div>
          <button
            aria-label="Hisobdan chiqish"
            title="Hisobdan chiqish"
            onClick={(e) => {
              e.stopPropagation();
              handleLogout();
            }}
            style={{
              border: 0,
              background: "transparent",
              color: "#94a3b8",
              cursor: "pointer",
              marginLeft: "auto",
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="close" size={15} />
          </button>
        </div>
      </aside>

      {/* Mobile navigation for students */}
      {role === "student" && (
        <nav className="mobile-nav" aria-label="Mobil navigatsiya">
          {[
            ["dashboard", "grid"],
            ["dna", "dna"],
            ["tasks", "file"],
            ["career", "briefcase"],
            ["certificates", "award"],
            ["settings", "settings"],
          ].map(([page, icon]) => (
            <button
              key={page}
              className={activePage === page ? "active" : ""}
              onClick={() => goTo(page as PageKey)}
            >
              <Icon name={icon as any} />
              <span>{page}</span>
            </button>
          ))}
        </nav>
      )}

      {/* Main Content Area */}
      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand">
            <Logo size="sm" showTagline={false} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div className="top-title">
              <strong>{currentRoleInfo.title}</strong>
              <span> / {displayOrg}</span>
            </div>

            {/* 3 Pilot Directions Switcher for Students */}
            {role === "student" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#f1f5f9",
                  padding: "4px 8px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                }}
              >
                <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--muted)" }}>PILOT YO‘NALISHI:</span>
                <select
                  value={direction}
                  onChange={(e) => handleDirectionChange(e.target.value as DirectionCode)}
                  style={{
                    background: "white",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    padding: "5px 10px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--navy)",
                    cursor: "pointer",
                  }}
                >
                  <option value="software">{directionLabels.software}</option>
                  <option value="computer">{directionLabels.computer}</option>
                  <option value="ai">{directionLabels.ai}</option>
                </select>
              </div>
            )}
          </div>

          <div className="top-actions">
            <button className="icon-button" aria-label="Bildirishnomalar">
              <Icon name="bell" />
              <span className="notification-dot" />
            </button>
            <div className="top-avatar">{currentUser.avatar}</div>

            {/* RBAC Security session badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "5px 12px",
                borderRadius: "20px",
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                color: "#059669",
                fontSize: "12px",
                fontWeight: 700,
              }}
              title="RBAC Xavfsizlik protokoli: Sessiya JWT va server auditi orqali himoyalangan"
            >
              <span
                style={{
                  display: "inline-block",
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: "#10b981",
                  boxShadow: "0 0 6px #10b981",
                }}
              />
              <span className="hidden sm:inline">RBAC: Himoyalangan</span>
            </div>

            <button
              onClick={handleLogout}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "white",
                color: "#475569",
                fontSize: "13.5px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "0.2s",
              }}
              title="Hisobdan chiqish"
            >
              <Icon name="close" size={13} />
              <span>Chiqish</span>
            </button>
          </div>
        </header>

        {/* Dynamic Role Views */}
        {role === "student" && (
          <StudentView
            direction={direction}
            activePage={activePage}
            onStartAssessment={() => setAssessmentOpen(true)}
            goToPage={goTo}
            user={currentUser}
            assessmentKey={assessmentScoreVersion}
          />
        )}

        {role === "teacher" && <TeacherPortal />}

        {role === "employer" && <EmployerPortal />}

        {role === "university" && (
          <UniversityDashboard activeTab={univTab as any} onTabChange={handleUnivTabChange} />
        )}

        {role === "moderator" && (
          <ModeratorQueue
            activeTab={moderatorTab}
            onTabChange={handleModeratorTabChange}
          />
        )}
      </main>

      {/* Interactive Assessment & AI Viva Modal */}
      <AssessmentModal
        isOpen={assessmentOpen}
        onClose={() => setAssessmentOpen(false)}
        direction={direction}
        userId={currentUser?.id}
        onAssessmentCompleted={(newScore) => {
          if (currentUser) {
            localStorage.setItem(`skill_dna_score_${currentUser.id}`, String(newScore));
            setAssessmentScoreVersion((v) => v + 1);
          }
        }}
      />

      {/* Role Switch Security Notification Toast */}
      {roleSwitchFeedback && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            background: "#0f172a",
            color: "#f8fafc",
            padding: "12px 18px",
            borderRadius: "10px",
            border: "1px solid #10b981",
            boxShadow: "0 12px 30px rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13.5px",
            fontWeight: 600,
            maxWidth: "460px",
          }}
        >
          <span style={{ display: "inline-flex", color: "#10b981", flexShrink: 0 }}>
            <Icon name="shieldCheck" size={20} />
          </span>
          <span>{roleSwitchFeedback}</span>
        </div>
      )}
    </div>
  );
}
