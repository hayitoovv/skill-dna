import { useState, useEffect } from "react";
import { Icon, Logo } from "./components/common/Icons";
import StudentView, { type PageKey } from "./components/student/StudentView";
import TeacherPortal from "./components/teacher/TeacherPortal";
import EmployerPortal from "./components/employer/EmployerPortal";
import NotificationBell from "./components/common/NotificationBell";
import type { EmployerTab } from "./components/employer/EmployerPortal";
import UniversityDashboard from "./components/university/UniversityDashboard";
import ModeratorQueue from "./components/moderator/ModeratorQueue";
import AuthScreen from "./components/auth/AuthScreen";
import AssessmentModal from "./components/student/AssessmentModal";
import SecurityModal from "./components/common/SecurityModal";
import type { DirectionCode, Role, User } from "./types";
import { demoUsers } from "./data/ontology";
import { api, hasSession, SESSION_EXPIRED_EVENT, PROFILE_UPDATED_EVENT } from "./services/api";
import { LanguageSwitcher, useI18n } from "./i18n";

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
  const { t } = useI18n();
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
  const [securityOpen, setSecurityOpen] = useState(false);

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

  const [employerTab, setEmployerTab] = useState<EmployerTab>(() => {
    try {
      const saved = localStorage.getItem("skill_dna_employer_tab");
      if (saved === "search" || saved === "verified" || saved === "invites") return saved;
    } catch {}
    return "search";
  });

  const handleEmployerTabChange = (tab: EmployerTab) => {
    setEmployerTab(tab);
    try {
      localStorage.setItem("skill_dna_employer_tab", tab);
    } catch {}
  };

  const [teacherTab, setTeacherTab] = useState<"heatmap" | "queue" | "remedial" | "viva">(() => {
    try {
      const saved = localStorage.getItem("skill_dna_teacher_tab");
      if (saved && ["heatmap", "queue", "remedial", "viva"].includes(saved)) {
        return saved as "heatmap" | "queue" | "remedial" | "viva";
      }
    } catch {}
    return "heatmap";
  });

  const handleTeacherTabChange = (tab: "heatmap" | "queue" | "remedial" | "viva") => {
    setTeacherTab(tab);
    try {
      localStorage.setItem("skill_dna_teacher_tab", tab);
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

    if (parsedUser && hasSession()) {
      api.getMe()
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
              photo: me.photo ?? null,
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

  const signOut = () => {
    setCurrentUser(null);
    setActiveRole("student");
    try {
      localStorage.removeItem("skill_dna_user");
      localStorage.removeItem("skill_dna_token");
      localStorage.removeItem("skill_dna_refresh");
      localStorage.removeItem("skill_dna_page");
      localStorage.removeItem("skill_dna_active_role");
    } catch {}
  };

  const handleLogout = () => {
    if (window.confirm(t("shell.logoutConfirm"))) signOut();
  };

  // Settings page changes (name, photo) update the shell right away
  useEffect(() => {
    const onProfile = (e: Event) => {
      const patch = (e as CustomEvent<Partial<User>>).detail;
      setCurrentUser((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch };
        try {
          localStorage.setItem("skill_dna_user", JSON.stringify(next));
        } catch {}
        return next;
      });
    };
    window.addEventListener(PROFILE_UPDATED_EVENT, onProfile);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, onProfile);
  }, []);

  // A dead session (expired refresh token, rotated server key) returns to login instead of silently showing demo data
  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, signOut);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, signOut);
  }, []);

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

      // The switcher only changes the view; roles are assigned by an administrator (section 2.3),
      // so live data in another portal still follows the account's real permissions.
      setRoleSwitchFeedback(t("shell.viewMode", { portal: t(`role.${newRole}`) }));
      setTimeout(() => setRoleSwitchFeedback(null), 4000);
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

  // Notification targets look like "student:career" / "employer:invites"; followed only in the matching portal
  const openNotificationLink = (link: string) => {
    const [portal, target] = link.split(":");
    if (portal === "student" && role === "student") goTo(target as PageKey);
    else if (portal === "employer" && role === "employer" && (target === "search" || target === "verified" || target === "invites")) {
      handleEmployerTabChange(target);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
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
        <div className="role-switcher">
          <label htmlFor="role-select">{t("shell.activePortal")}</label>
          <select
            id="role-select"
            value={role}
            onChange={(e) => handleRoleChange(e.target.value as Role)}
          >
            <option value="student">{t("roleopt.student")}</option>
            <option value="teacher">{t("roleopt.teacher")}</option>
            <option value="employer">{t("roleopt.employer")}</option>
            <option value="university">{t("roleopt.university")}</option>
            <option value="moderator">{t("roleopt.moderator")}</option>
          </select>
        </div>

        {/* Navigation based on Role */}
        {role === "student" && (
          <nav className="main-nav" aria-label="Asosiy navigatsiya">
            <div className="nav-label">{t("nav.studentPanel")}</div>
            <button
              className={`nav-item ${activePage === "dashboard" ? "active" : ""}`}
              onClick={() => goTo("dashboard")}
            >
              <Icon name="grid" /> {t("nav.dashboard")}
            </button>
            <button className={`nav-item ${activePage === "dna" ? "active" : ""}`} onClick={() => goTo("dna")}>
              <Icon name="dna" /> {t("nav.myDna")}
            </button>
            <button className={`nav-item ${activePage === "tasks" ? "active" : ""}`} onClick={() => goTo("tasks")}>
              <Icon name="file" /> {t("nav.tasks")} <span className="nav-pill">5</span>
            </button>
            <button className={`nav-item ${activePage === "career" ? "active" : ""}`} onClick={() => goTo("career")}>
              <Icon name="briefcase" /> {t("nav.career")}
            </button>
            <div className="nav-label section">{t("nav.profileSettings")}</div>
            <button
              className={`nav-item ${activePage === "certificates" ? "active" : ""}`}
              onClick={() => goTo("certificates")}
            >
              <Icon name="award" /> {t("nav.certificates")}
            </button>
            <button
              className={`nav-item ${activePage === "settings" ? "active" : ""}`}
              onClick={() => goTo("settings")}
            >
              <Icon name="settings" /> {t("nav.settings")}
            </button>
          </nav>
        )}

        {role === "teacher" && (
          <nav className="main-nav" aria-label="O‘qituvchi navigatsiyasi">
            <div className="nav-label">{t("nav.teacherModules")}</div>
            <button
              className={`nav-item ${teacherTab === "heatmap" ? "active" : ""}`}
              onClick={() => handleTeacherTabChange("heatmap")}
            >
              <Icon name="users" /> {t("nav.heatmap")}
            </button>
            <button
              className={`nav-item ${teacherTab === "queue" ? "active" : ""}`}
              onClick={() => handleTeacherTabChange("queue")}
            >
              <Icon name="check" /> {t("nav.proveQueue")}
            </button>
            <button
              className={`nav-item ${teacherTab === "remedial" ? "active" : ""}`}
              onClick={() => handleTeacherTabChange("remedial")}
            >
              <Icon name="code" /> {t("nav.remedial")}
            </button>
            <button
              className={`nav-item ${teacherTab === "viva" ? "active" : ""}`}
              onClick={() => handleTeacherTabChange("viva")}
            >
              <Icon name="file" /> {t("nav.vivaResults")}
            </button>
          </nav>
        )}

        {role === "employer" && (
          <nav className="main-nav" aria-label="Ish beruvchi navigatsiyasi">
            <div className="nav-label">{t("nav.employer")}</div>
            <button
              className={`nav-item ${employerTab === "search" ? "active" : ""}`}
              onClick={() => handleEmployerTabChange("search")}
            >
              <Icon name="search" /> {t("nav.candidateSearch")}
            </button>
            <button
              className={`nav-item ${employerTab === "verified" ? "active" : ""}`}
              onClick={() => handleEmployerTabChange("verified")}
            >
              <Icon name="shield" /> {t("nav.verified")}
            </button>
            <button
              className={`nav-item ${employerTab === "invites" ? "active" : ""}`}
              onClick={() => handleEmployerTabChange("invites")}
            >
              <Icon name="briefcase" /> {t("nav.offers")}
            </button>
          </nav>
        )}

        {role === "university" && (
          <nav className="main-nav" aria-label="Universitet navigatsiyasi">
            <div className="nav-label">{t("nav.mainDashboard")}</div>
            <button
              className={`nav-item ${univTab === "dashboard" || univTab === "analytics" ? "active" : ""}`}
              onClick={() => handleUnivTabChange("dashboard")}
            >
              <Icon name="grid" /> {t("nav.dashboard")}
            </button>

            <div className="nav-label section">{t("nav.academicMgmt")}</div>
            <button
              className={`nav-item ${univTab === "groups" ? "active" : ""}`}
              onClick={() => handleUnivTabChange("groups")}
            >
              <Icon name="users" /> {t("nav.groups")} <span className="nav-pill">4</span>
            </button>
            <button
              className={`nav-item ${univTab === "teachers" ? "active" : ""}`}
              onClick={() => handleUnivTabChange("teachers")}
            >
              <Icon name="user" /> {t("nav.teachers")} <span className="nav-pill">4</span>
            </button>
            <button
              className={`nav-item ${univTab === "students" ? "active" : ""}`}
              onClick={() => handleUnivTabChange("students")}
            >
              <Icon name="dna" /> {t("nav.students")} <span className="nav-pill">6</span>
            </button>

            <div className="nav-label section">{t("nav.academicAnalysis")}</div>
            <button
              className={`nav-item ${univTab === "curriculum" ? "active" : ""}`}
              onClick={() => handleUnivTabChange("curriculum")}
            >
              <Icon name="alert" /> {t("nav.curriculum")}
            </button>
            <button
              className={`nav-item ${univTab === "levels" ? "active" : ""}`}
              onClick={() => handleUnivTabChange("levels")}
            >
              <Icon name="award" /> {t("nav.levels")}
            </button>
          </nav>
        )}

        {role === "moderator" && (
          <nav className="main-nav" aria-label="Moderator navigatsiyasi">
            <div className="nav-label">{t("nav.integrity")}</div>
            <button
              className={`nav-item ${moderatorTab === "flags" ? "active" : ""}`}
              onClick={() => handleModeratorTabChange("flags")}
            >
              <Icon name="shield" /> {t("nav.flags")}
            </button>
            <button
              className={`nav-item ${moderatorTab === "transcripts" ? "active" : ""}`}
              onClick={() => handleModeratorTabChange("transcripts")}
            >
              <Icon name="file" /> {t("nav.transcripts")}
            </button>
            <button
              className={`nav-item ${moderatorTab === "rules" ? "active" : ""}`}
              onClick={() => handleModeratorTabChange("rules")}
            >
              <Icon name="settings" /> {t("nav.ontology")}
            </button>
          </nav>
        )}

        {/* Current user mini info with Logout button */}
        <div
          className="user-mini"
          onClick={() => goTo("settings")}
          title={t("shell.profileHint")}
        >
          <div className="avatar">{currentUser.photo ? <img src={currentUser.photo} alt="" /> : currentUser.avatar}</div>
          <div>
            <strong>{currentUser.name}</strong>
            <span>{displayOrg}</span>
          </div>
          <button
            aria-label="Hisobdan chiqish"
            title="Hisobdan chiqish"
            onClick={(e) => {
              e.stopPropagation();
              handleLogout();
            }}
          >
            <Icon name="logout" size={15} />
          </button>
        </div>
      </aside>

      {/* Mobile navigation for students */}
      {role === "student" && (
        <nav className="mobile-nav" aria-label="Mobil navigatsiya">
          {[
            ["dashboard", "grid", "Panel"],
            ["dna", "dna", "DNA"],
            ["tasks", "file", "Vazifalar"],
            ["career", "briefcase", "Karyera"],
            ["certificates", "award", "Sertifikat"],
            ["settings", "settings", "Sozlama"],
          ].map(([page, icon, label]) => (
            <button
              key={page}
              className={activePage === page ? "active" : ""}
              onClick={() => goTo(page as PageKey)}
            >
              <Icon name={icon as any} />
              <span>{label}</span>
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

          <div className="topbar-left">
            <div className="top-title">
              <span>{displayOrg}</span>
              <span className="crumb-sep">/</span>
              <strong>{t(`role.${role}`)}</strong>
            </div>

            {/* 3 Pilot Directions Switcher for Students */}
            {role === "student" && (
              <div className="direction-switch">
                <span>{t("shell.direction")}</span>
                <select
                  value={direction}
                  onChange={(e) => handleDirectionChange(e.target.value as DirectionCode)}
                >
                  <option value="software">{t("dir.software")}</option>
                  <option value="computer">{t("dir.computer")}</option>
                  <option value="ai">{t("dir.ai")}</option>
                </select>
              </div>
            )}
          </div>

          <div className="top-actions">
            {/* RBAC Security session badge */}
            <div
              className="session-badge"
              title="RBAC Xavfsizlik protokoli: Sessiya JWT va server auditi orqali himoyalangan"
            >
              <i />
              <span>{t("shell.protected")}</span>
            </div>

            <button
              className="icon-button"
              aria-label="Xavfsizlik: ikki bosqichli tasdiq"
              title={t("shell.security")}
              onClick={() => setSecurityOpen(true)}
              style={["moderator", "university", "super_admin"].includes(currentUser.role) ? { color: "var(--success)" } : undefined}
            >
              <Icon name="shieldCheck" size={17} />
            </button>
            <LanguageSwitcher compact />
            <NotificationBell label={t("shell.notifications")} onNavigate={openNotificationLink} />
            <div className="top-avatar">{currentUser.photo ? <img src={currentUser.photo} alt="" /> : currentUser.avatar}</div>

            <button className="logout-button" onClick={handleLogout} title="Hisobdan chiqish">
              <Icon name="logout" size={14} />
              <span className="hidden sm:inline">{t("shell.logout")}</span>
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

        {role === "teacher" && (
          <TeacherPortal
            activeTab={teacherTab}
            onTabChange={handleTeacherTabChange}
          />
        )}

        {role === "employer" && <EmployerPortal activeTab={employerTab} onTabChange={handleEmployerTabChange} />}

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
        onAssessmentCompleted={() => setAssessmentScoreVersion((v) => v + 1)}
      />

      {securityOpen && <SecurityModal onClose={() => setSecurityOpen(false)} />}

      {/* Role Switch Security Notification Toast */}
      {roleSwitchFeedback && (
        <div className="app-toast" role="status">
          <Icon name="shieldCheck" size={18} />
          <span>{roleSwitchFeedback}</span>
        </div>
      )}
    </div>
  );
}
