import { useState, useId, useEffect } from "react";
import { Icon } from "../common/Icons";
import { api, hasSession } from "../../services/api";
import { universityAnalyticsData } from "../../data/ontology";
import type { DirectionCode } from "../../types";

export type AdminTab = "dashboard" | "analytics" | "groups" | "teachers" | "students" | "workflow" | "curriculum" | "levels";

export interface UniversityDashboardProps {
  activeTab?: AdminTab;
  onTabChange?: (tab: AdminTab) => void;
}

export interface TeacherItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  direction: DirectionCode;
  directionName: string;
  department: string;
  title: string;
  assignedGroups: string[];
  subjects: string[];
  avatar: string;
}

export interface GroupItem {
  id: string;
  code: string;
  direction: DirectionCode;
  directionName: string;
  course: string;
  curatorId: string;
  curatorName: string;
  studentsCount: number;
  avgScore: number;
  createdDate: string;
}

export interface UniversityStudentItem {
  id: string;
  name: string;
  email: string;
  groupCode: string;
  direction: DirectionCode;
  directionName: string;
  course: string;
  curatorName: string;
  level: string;
  score: number;
  status: "active" | "graduated" | "pending";
}

const initialTeachers: TeacherItem[] = [
  {
    id: "tch-1",
    name: "Prof. Otabek Qodirov",
    email: "otabek.qodirov@bstu.uz",
    phone: "+998 90 123 45 67",
    direction: "software",
    directionName: "Dasturiy injiniring",
    department: "Dasturiy ta’minot kafedrasi",
    title: "Professor, Kafedra mudiri",
    assignedGroups: ["941-21 DI", "101-26 DI"],
    subjects: ["Backend & REST API", "Tizimlar arxitekturasi"],
    avatar: "OQ",
  },
  {
    id: "tch-2",
    name: "Dots. Nilufar Karimova",
    email: "nilufar.karimova@bstu.uz",
    phone: "+998 91 345 67 89",
    direction: "ai",
    directionName: "Sun’iy intellekt",
    department: "Axborot texnologiyalari kafedrasi",
    title: "Dotsent, PhD",
    assignedGroups: ["202-24 AI"],
    subjects: ["Machine Learning", "NLP & Prompt Engineering"],
    avatar: "NK",
  },
  {
    id: "tch-3",
    name: "Akmal Rahimov",
    email: "rahimov@edu.uz",
    phone: "+998 93 456 78 90",
    direction: "software",
    directionName: "Dasturiy injiniring",
    department: "Dasturiy ta’minot kafedrasi",
    title: "Katta o‘qituvchi",
    assignedGroups: ["941-21 DI"],
    subjects: ["SQL va relyatsion MB", "DevOps asoslari"],
    avatar: "AR",
  },
  {
    id: "tch-4",
    name: "Jasur Aliyev",
    email: "jasur.aliyev@bstu.uz",
    phone: "+998 97 789 01 23",
    direction: "computer",
    directionName: "Kompyuter injiniringi",
    department: "Kompyuter tizimlari kafedrasi",
    title: "Katta o‘qituvchi",
    assignedGroups: ["303-23 KI"],
    subjects: ["Kompyuter tarmoqlari", "Linux & Hardware"],
    avatar: "JA",
  },
];

const initialGroups: GroupItem[] = [
  {
    id: "grp-1",
    code: "941-21 DI",
    direction: "software",
    directionName: "Dasturiy injiniring",
    course: "3-kurs",
    curatorId: "tch-1",
    curatorName: "Prof. Otabek Qodirov",
    studentsCount: 26,
    avgScore: 78.4,
    createdDate: "2023-09-01",
  },
  {
    id: "grp-2",
    code: "101-26 DI",
    direction: "software",
    directionName: "Dasturiy injiniring",
    course: "1-kurs",
    curatorId: "tch-1",
    curatorName: "Prof. Otabek Qodirov",
    studentsCount: 24,
    avgScore: 68.2,
    createdDate: "2025-09-01",
  },
  {
    id: "grp-3",
    code: "202-24 AI",
    direction: "ai",
    directionName: "Sun’iy intellekt",
    course: "2-kurs",
    curatorId: "tch-2",
    curatorName: "Dots. Nilufar Karimova",
    studentsCount: 22,
    avgScore: 74.0,
    createdDate: "2024-09-01",
  },
  {
    id: "grp-4",
    code: "303-23 KI",
    direction: "computer",
    directionName: "Kompyuter injiniringi",
    course: "3-kurs",
    curatorId: "tch-4",
    curatorName: "Jasur Aliyev",
    studentsCount: 25,
    avgScore: 71.5,
    createdDate: "2023-09-01",
  },
];

const initialStudents: UniversityStudentItem[] = [
  {
    id: "stu-1",
    name: "Shoxrux Mirzayev",
    email: "shoxrux@edu.uz",
    groupCode: "941-21 DI",
    direction: "software",
    directionName: "Dasturiy injiniring",
    course: "3-kurs",
    curatorName: "Prof. Otabek Qodirov",
    level: "L3",
    score: 82,
    status: "active",
  },
  {
    id: "stu-2",
    name: "Azizbek Sobirov",
    email: "azizbek.sobirov@gmail.com",
    groupCode: "941-21 DI",
    direction: "software",
    directionName: "Dasturiy injiniring",
    course: "3-kurs",
    curatorName: "Prof. Otabek Qodirov",
    level: "L4",
    score: 86,
    status: "active",
  },
  {
    id: "stu-3",
    name: "Behruz Hayitov",
    email: "behruz@gmail.com",
    groupCode: "101-26 DI",
    direction: "software",
    directionName: "Dasturiy injiniring",
    course: "1-kurs",
    curatorName: "Prof. Otabek Qodirov",
    level: "L2",
    score: 69,
    status: "active",
  },
  {
    id: "stu-4",
    name: "Dildora Rahimova",
    email: "dildora.rahimova@bstu.uz",
    groupCode: "202-24 AI",
    direction: "ai",
    directionName: "Sun’iy intellekt",
    course: "2-kurs",
    curatorName: "Dots. Nilufar Karimova",
    level: "L3",
    score: 79,
    status: "active",
  },
  {
    id: "stu-5",
    name: "Sardor Ahmedov",
    email: "sardor.ahmedov@bstu.uz",
    groupCode: "303-23 KI",
    direction: "computer",
    directionName: "Kompyuter injiniringi",
    course: "3-kurs",
    curatorName: "Jasur Aliyev",
    level: "L3",
    score: 75,
    status: "active",
  },
  {
    id: "stu-6",
    name: "Otabek Ergashev",
    email: "otabek.ergashev@bstu.uz",
    groupCode: "101-26 DI",
    direction: "software",
    directionName: "Dasturiy injiniring",
    course: "1-kurs",
    curatorName: "Prof. Otabek Qodirov",
    level: "L2",
    score: 64,
    status: "active",
  },
];

// ---------------------------------------------------------------------------
// Live data wiring (GET /university/analytics, /teacher/groups, /teacher/groups/{id}/gaps)
// ---------------------------------------------------------------------------

type DataStatus = "loading" | "live" | "demo";

interface LiveAnalytics {
  students_total: number;
  directions: {
    code: string;
    name: string;
    students: number;
    avg_score: number | null;
    avg_confidence: number | null;
    courses: Record<string, number>;
  }[];
  level_distribution: Record<string, number>;
  curriculum_gaps: { skill: string; code: string; avg_score: number; students: number; below_70_pct: number }[];
  open_flags: number;
}

interface LiveGroup {
  group_id: string;
  students: number;
}

interface LiveGroupGaps {
  group_id: string;
  students_total: number;
  skills: {
    skill: { id: string; code: string; name: string };
    students_scored: number;
    avg_score: number;
    below_70: number;
    gap_pct: number;
  }[];
  students: { id: string; name: string; email: string; level: string; score: number; skills_scored: number }[];
}

interface DirectionView {
  key: string;
  name: string;
  students: number;
  avgScore: number | null;
  avgConfidence: number | null;
  readinessPct: number | null;
  courses: string | null;
}

interface LevelView {
  level: string;
  count: number;
  pct: string;
}

interface GapView {
  key: string;
  direction: string;
  skill: string;
  badge: string;
  recommendation: string | null;
  meta: string | null;
  severe: boolean;
}

const LEVEL_LABELS: Record<string, string> = {
  L0: "L0 BOSHLANG‘ICH",
  L1: "L1 KNOW",
  L2: "L2 APPLY",
  L3: "L3 ADAPT",
  L4: "L4 CREATE",
  L5: "L5 MASTER",
};

function formatPct(count: number, total: number): string {
  if (!total) return "0%";
  const v = (100 * count) / total;
  return `${v < 10 && v % 1 !== 0 ? v.toFixed(1) : Math.round(v)}%`;
}

function DataBadge({ status }: { status: DataStatus }) {
  const palette =
    status === "live"
      ? { color: "var(--success-400)", bg: "var(--success-soft)", label: "Jonli ma’lumot" }
      : status === "loading"
      ? { color: "var(--muted)", bg: "var(--surface-3)", label: "Yuklanmoqda…" }
      : { color: "var(--warning-fg)", bg: "var(--warning-soft)", label: "Demo ma’lumot" };
  return (
    <span
      title={
        status === "demo"
          ? "Server ma’lumotlari mavjud emas (kirish huquqi yoki tarmoq). Ko‘rsatilgan raqamlar namunaviy."
          : status === "live"
          ? "Ma’lumotlar serverdan real vaqtda olindi."
          : undefined
      }
      style={{
        fontSize: "11px",
        fontWeight: 700,
        color: palette.color,
        background: palette.bg,
        padding: "3px 8px",
        borderRadius: "5px",
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: palette.color }} />
      {palette.label}
    </span>
  );
}

export default function UniversityDashboard({
  activeTab: propActiveTab,
  onTabChange,
}: UniversityDashboardProps = {}) {
  const [internalTab, setInternalTab] = useState<AdminTab>("dashboard");
  const activeTab = propActiveTab || internalTab;

  const setActiveTab = (t: AdminTab) => {
    setInternalTab(t);
    if (onTabChange) onTabChange(t);
  };
  const [downloaded, setDownloaded] = useState(false);

  // Stored state with local fallback
  const [teachers, setTeachers] = useState<TeacherItem[]>(() => {
    try {
      const saved = localStorage.getItem("skill_dna_univ_teachers");
      return saved ? JSON.parse(saved) : initialTeachers;
    } catch {
      return initialTeachers;
    }
  });

  const [groups, setGroups] = useState<GroupItem[]>(() => {
    try {
      const saved = localStorage.getItem("skill_dna_univ_groups");
      return saved ? JSON.parse(saved) : initialGroups;
    } catch {
      return initialGroups;
    }
  });

  const [students, setStudents] = useState<UniversityStudentItem[]>(() => {
    try {
      const saved = localStorage.getItem("skill_dna_univ_students");
      return saved ? JSON.parse(saved) : initialStudents;
    } catch {
      return initialStudents;
    }
  });

  // Modal states
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [assigningGroup, setAssigningGroup] = useState<GroupItem | null>(null);

  // Form states for modals
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherEmail, setNewTeacherEmail] = useState("");
  const [newTeacherPhone, setNewTeacherPhone] = useState("+998 ");
  const [newTeacherDirection, setNewTeacherDirection] = useState<DirectionCode>("software");
  const [newTeacherTitle, setNewTeacherTitle] = useState("Katta o‘qituvchi");

  const [newGroupCode, setNewGroupCode] = useState("");
  const [newGroupDirection, setNewGroupDirection] = useState<DirectionCode>("software");
  const [newGroupCourse, setNewGroupCourse] = useState("1-kurs");
  const [newGroupCuratorId, setNewGroupCuratorId] = useState("");

  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [newStudentGroupCode, setNewStudentGroupCode] = useState<string>("none");
  const [newStudentDirection, setNewStudentDirection] = useState<DirectionCode>("software");
  const [newStudentCourse, setNewStudentCourse] = useState("1-kurs");

  const [assigningStudent, setAssigningStudent] = useState<UniversityStudentItem | null>(null);
  const [selectedGroupForStudent, setSelectedGroupForStudent] = useState<string>("");

  // CRUD states for Teachers
  const [editingTeacher, setEditingTeacher] = useState<TeacherItem | null>(null);
  const [editTeacherName, setEditTeacherName] = useState("");
  const [editTeacherEmail, setEditTeacherEmail] = useState("");
  const [editTeacherPhone, setEditTeacherPhone] = useState("");
  const [editTeacherDirection, setEditTeacherDirection] = useState<DirectionCode>("software");
  const [editTeacherTitle, setEditTeacherTitle] = useState("");
  const [editTeacherDepartment, setEditTeacherDepartment] = useState("");
  const [deletingTeacher, setDeletingTeacher] = useState<TeacherItem | null>(null);

  // CRUD states for Groups
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);
  const [editGroupCode, setEditGroupCode] = useState("");
  const [editGroupCourse, setEditGroupCourse] = useState("1-kurs");
  const [editGroupDirection, setEditGroupDirection] = useState<DirectionCode>("software");
  const [editGroupCuratorId, setEditGroupCuratorId] = useState("");
  const [deletingGroup, setDeletingGroup] = useState<GroupItem | null>(null);

  // CRUD states for Students
  const [editingStudent, setEditingStudent] = useState<UniversityStudentItem | null>(null);
  const [editStudentName, setEditStudentName] = useState("");
  const [editStudentEmail, setEditStudentEmail] = useState("");
  const [editStudentGroupCode, setEditStudentGroupCode] = useState<string>("none");
  const [editStudentDirection, setEditStudentDirection] = useState<DirectionCode>("software");
  const [editStudentCourse, setEditStudentCourse] = useState("1-kurs");
  const [editStudentLevel, setEditStudentLevel] = useState("L1");
  const [editStudentScore, setEditStudentScore] = useState<number>(60);
  const [deletingStudent, setDeletingStudent] = useState<UniversityStudentItem | null>(null);

  const [selectedCuratorForGroup, setSelectedCuratorForGroup] = useState("");
  const [studentFilterGroup, setStudentFilterGroup] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDownload = () => {
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  };

  // Add Teacher
  const handleCreateTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherName.trim() || !newTeacherEmail.trim()) return;

    const dirNames: Record<DirectionCode, string> = {
      software: "Dasturiy injiniring",
      computer: "Kompyuter injiniringi",
      ai: "Sun’iy intellekt",
    };

    const initials = newTeacherName
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    const created: TeacherItem = {
      id: `tch-${Date.now()}`,
      name: newTeacherName.trim(),
      email: newTeacherEmail.trim(),
      phone: newTeacherPhone.trim(),
      direction: newTeacherDirection,
      directionName: dirNames[newTeacherDirection],
      department: `${dirNames[newTeacherDirection]} kafedrasi`,
      title: newTeacherTitle,
      assignedGroups: [],
      subjects: ["Asosiy mutaxassislik moduli"],
      avatar: initials || "TQ",
    };

    const updated = [created, ...teachers];
    setTeachers(updated);
    try {
      localStorage.setItem("skill_dna_univ_teachers", JSON.stringify(updated));
    } catch {}

    setNewTeacherName("");
    setNewTeacherEmail("");
    setShowAddTeacher(false);
    showToast(`Yangi o‘qituvchi ${created.name} muvaffaqiyatli ro‘yxatga olindi.`);
  };

  // Open Edit Teacher modal
  const handleOpenEditTeacher = (teacher: TeacherItem) => {
    setEditingTeacher(teacher);
    setEditTeacherName(teacher.name);
    setEditTeacherEmail(teacher.email);
    setEditTeacherPhone(teacher.phone || "+998 ");
    setEditTeacherDirection(teacher.direction);
    setEditTeacherTitle(teacher.title);
    setEditTeacherDepartment(teacher.department);
  };

  // Update Teacher
  const handleUpdateTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher || !editTeacherName.trim() || !editTeacherEmail.trim()) return;

    const dirNames: Record<DirectionCode, string> = {
      software: "Dasturiy injiniring",
      computer: "Kompyuter injiniringi",
      ai: "Sun’iy intellekt",
    };

    const oldName = editingTeacher.name;
    const newName = editTeacherName.trim();

    const updatedTeachers = teachers.map((t) => {
      if (t.id === editingTeacher.id) {
        return {
          ...t,
          name: newName,
          email: editTeacherEmail.trim(),
          phone: editTeacherPhone.trim(),
          direction: editTeacherDirection,
          directionName: dirNames[editTeacherDirection],
          title: editTeacherTitle.trim(),
          department: editTeacherDepartment.trim() || `${dirNames[editTeacherDirection]} kafedrasi`,
        };
      }
      return t;
    });
    setTeachers(updatedTeachers);

    // If teacher's name changed, update curator name in their groups and students
    let updatedGroups = groups;
    let updatedStudents = students;
    if (oldName !== newName) {
      updatedGroups = groups.map((g) => {
        if (g.curatorId === editingTeacher.id) {
          return { ...g, curatorName: newName };
        }
        return g;
      });
      setGroups(updatedGroups);

      updatedStudents = students.map((s) => {
        if (s.curatorName === oldName) {
          return { ...s, curatorName: newName };
        }
        return s;
      });
      setStudents(updatedStudents);
      try {
        localStorage.setItem("skill_dna_univ_students", JSON.stringify(updatedStudents));
      } catch {}
    }

    try {
      localStorage.setItem("skill_dna_univ_teachers", JSON.stringify(updatedTeachers));
      localStorage.setItem("skill_dna_univ_groups", JSON.stringify(updatedGroups));
    } catch {}

    setEditingTeacher(null);
    showToast(`O‘qituvchi "${newName}" ma’lumotlari muvaffaqiyatli yangilandi.`);
  };

  // Delete Teacher
  const handleDeleteTeacher = () => {
    if (!deletingTeacher) return;

    const teacherName = deletingTeacher.name;
    const updatedTeachers = teachers.filter((t) => t.id !== deletingTeacher.id);
    setTeachers(updatedTeachers);

    // In groups assigned to this teacher, clear curator
    const updatedGroups = groups.map((g) => {
      if (g.curatorId === deletingTeacher.id) {
        return { ...g, curatorId: "", curatorName: "Biriktirilmagan" };
      }
      return g;
    });
    setGroups(updatedGroups);

    // In students assigned to this teacher, clear curator
    const updatedStudents = students.map((s) => {
      if (s.curatorName === teacherName) {
        return { ...s, curatorName: "Biriktirilmagan" };
      }
      return s;
    });
    setStudents(updatedStudents);

    try {
      localStorage.setItem("skill_dna_univ_teachers", JSON.stringify(updatedTeachers));
      localStorage.setItem("skill_dna_univ_groups", JSON.stringify(updatedGroups));
      localStorage.setItem("skill_dna_univ_students", JSON.stringify(updatedStudents));
    } catch {}

    setDeletingTeacher(null);
    showToast(`O‘qituvchi "${teacherName}" bazadan o‘chirildi.`);
  };

  // Open Add Group modal with clean state
  const handleOpenAddGroup = () => {
    setNewGroupCode("");
    setNewGroupCuratorId("");
    setNewGroupCourse("1-kurs");
    setNewGroupDirection("software");
    setShowAddGroup(true);
  };

  // Close Add Group modal
  const handleCloseAddGroup = () => {
    setNewGroupCode("");
    setNewGroupCuratorId("");
    setShowAddGroup(false);
  };

  // Add Group (Curator is optional)
  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupCode.trim()) return;

    const dirNames: Record<DirectionCode, string> = {
      software: "Dasturiy injiniring",
      computer: "Kompyuter injiniringi",
      ai: "Sun’iy intellekt",
    };

    const isTeacherSelected = Boolean(newGroupCuratorId && newGroupCuratorId.trim() !== "" && newGroupCuratorId !== "none");
    const curator = isTeacherSelected ? (teachers.find((t) => t.id === newGroupCuratorId) || null) : null;

    const created: GroupItem = {
      id: `grp-${Date.now()}`,
      code: newGroupCode.trim().toUpperCase(),
      direction: newGroupDirection,
      directionName: dirNames[newGroupDirection],
      course: newGroupCourse,
      curatorId: curator ? curator.id : "",
      curatorName: curator ? curator.name : "Biriktirilmagan",
      studentsCount: 0,
      avgScore: 0,
      createdDate: new Date().toISOString().split("T")[0],
    };

    // Update teacher assignedGroups only if curator is selected
    if (curator) {
      const updatedTeachers = teachers.map((t) => {
        if (t.id === curator.id && !t.assignedGroups.includes(created.code)) {
          return { ...t, assignedGroups: [...t.assignedGroups, created.code] };
        }
        return t;
      });
      setTeachers(updatedTeachers);
      try {
        localStorage.setItem("skill_dna_univ_teachers", JSON.stringify(updatedTeachers));
      } catch {}
    }

    const updatedGroups = [...groups, created];
    setGroups(updatedGroups);
    try {
      localStorage.setItem("skill_dna_univ_groups", JSON.stringify(updatedGroups));
    } catch {}

    setNewGroupCode("");
    setNewGroupCuratorId("");
    setNewGroupCourse("1-kurs");
    setNewGroupDirection("software");
    setShowAddGroup(false);

    if (curator) {
      showToast(`"${created.code}" guruhi yaratildi va ${curator.name}ga biriktirildi.`);
    } else {
      showToast(`"${created.code}" guruhi yaratildi (O‘qituvchisiz saqlandi, keyinchalik biriktirish mumkin).`);
    }
  };

  // Assign or Re-assign Curator Teacher to Group
  const handleSaveGroupAssignment = () => {
    if (!assigningGroup) return;
    const isTeacherSelected = Boolean(selectedCuratorForGroup && selectedCuratorForGroup.trim() !== "" && selectedCuratorForGroup !== "none");
    const selectedTeacher = isTeacherSelected ? (teachers.find((t) => t.id === selectedCuratorForGroup) || null) : null;
    const prevTeacherId = assigningGroup.curatorId;

    // Update group
    const updatedGroups = groups.map((g) => {
      if (g.id === assigningGroup.id) {
        return {
          ...g,
          curatorId: selectedTeacher ? selectedTeacher.id : "",
          curatorName: selectedTeacher ? selectedTeacher.name : "Biriktirilmagan",
        };
      }
      return g;
    });
    setGroups(updatedGroups);

    // Update teacher's assigned groups
    const updatedTeachers = teachers.map((t) => {
      if (selectedTeacher && t.id === selectedTeacher.id && !t.assignedGroups.includes(assigningGroup.code)) {
        return { ...t, assignedGroups: [...t.assignedGroups, assigningGroup.code] };
      }
      if (prevTeacherId && t.id === prevTeacherId && (!selectedTeacher || t.id !== selectedTeacher.id)) {
        return { ...t, assignedGroups: t.assignedGroups.filter((c) => c !== assigningGroup.code) };
      }
      return t;
    });
    setTeachers(updatedTeachers);

    // Also update curator in students of this group
    const updatedStudents = students.map((s) => {
      if (s.groupCode === assigningGroup.code) {
        return { ...s, curatorName: selectedTeacher ? selectedTeacher.name : "Biriktirilmagan" };
      }
      return s;
    });
    setStudents(updatedStudents);

    try {
      localStorage.setItem("skill_dna_univ_groups", JSON.stringify(updatedGroups));
      localStorage.setItem("skill_dna_univ_teachers", JSON.stringify(updatedTeachers));
      localStorage.setItem("skill_dna_univ_students", JSON.stringify(updatedStudents));
    } catch {}

    setAssigningGroup(null);
    if (selectedTeacher) {
      showToast(`"${assigningGroup.code}" guruhi endi ${selectedTeacher.name}ga biriktirildi.`);
    } else {
      showToast(`"${assigningGroup.code}" guruhi o‘qituvchidan ajratildi.`);
    }
  };

  // Open Edit Group modal
  const handleOpenEditGroup = (group: GroupItem) => {
    setEditingGroup(group);
    setEditGroupCode(group.code);
    setEditGroupCourse(group.course);
    setEditGroupDirection(group.direction);
    setEditGroupCuratorId(group.curatorId || "");
  };

  // Update Group
  const handleUpdateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup || !editGroupCode.trim()) return;

    const dirNames: Record<DirectionCode, string> = {
      software: "Dasturiy injiniring",
      computer: "Kompyuter injiniringi",
      ai: "Sun’iy intellekt",
    };

    const oldCode = editingGroup.code;
    const newCode = editGroupCode.trim().toUpperCase();
    const oldCuratorId = editingGroup.curatorId;
    const isTeacherSelected = Boolean(editGroupCuratorId && editGroupCuratorId.trim() !== "" && editGroupCuratorId !== "none");
    const newCurator = isTeacherSelected ? (teachers.find((t) => t.id === editGroupCuratorId) || null) : null;

    // Update group in groups list
    const updatedGroups = groups.map((g) => {
      if (g.id === editingGroup.id) {
        return {
          ...g,
          code: newCode,
          course: editGroupCourse,
          direction: editGroupDirection,
          directionName: dirNames[editGroupDirection],
          curatorId: newCurator ? newCurator.id : "",
          curatorName: newCurator ? newCurator.name : "Biriktirilmagan",
        };
      }
      return g;
    });
    setGroups(updatedGroups);

    // Update students belonging to this group
    const updatedStudents = students.map((s) => {
      if (s.groupCode === oldCode) {
        return {
          ...s,
          groupCode: newCode,
          course: editGroupCourse,
          direction: editGroupDirection,
          directionName: dirNames[editGroupDirection],
          curatorName: newCurator ? newCurator.name : "Biriktirilmagan",
        };
      }
      return s;
    });
    setStudents(updatedStudents);

    // Update teachers assignedGroups list
    const updatedTeachers = teachers.map((t) => {
      let assigned = t.assignedGroups.filter((c) => c !== oldCode && c !== newCode);
      if (newCurator && t.id === newCurator.id) {
        assigned.push(newCode);
      }
      return { ...t, assignedGroups: assigned };
    });
    setTeachers(updatedTeachers);

    try {
      localStorage.setItem("skill_dna_univ_groups", JSON.stringify(updatedGroups));
      localStorage.setItem("skill_dna_univ_students", JSON.stringify(updatedStudents));
      localStorage.setItem("skill_dna_univ_teachers", JSON.stringify(updatedTeachers));
    } catch {}

    setEditingGroup(null);
    showToast(`"${newCode}" guruhi ma’lumotlari muvaffaqiyatli yangilandi.`);
  };

  // Delete Group
  const handleDeleteGroup = () => {
    if (!deletingGroup) return;

    const groupCode = deletingGroup.code;
    const updatedGroups = groups.filter((g) => g.id !== deletingGroup.id);
    setGroups(updatedGroups);

    // For students in this group, set to unassigned
    const updatedStudents = students.map((s) => {
      if (s.groupCode === groupCode) {
        return { ...s, groupCode: "", curatorName: "Biriktirilmagan" };
      }
      return s;
    });
    setStudents(updatedStudents);

    // Remove group from teachers assignedGroups
    const updatedTeachers = teachers.map((t) => {
      return { ...t, assignedGroups: t.assignedGroups.filter((c) => c !== groupCode) };
    });
    setTeachers(updatedTeachers);

    try {
      localStorage.setItem("skill_dna_univ_groups", JSON.stringify(updatedGroups));
      localStorage.setItem("skill_dna_univ_students", JSON.stringify(updatedStudents));
      localStorage.setItem("skill_dna_univ_teachers", JSON.stringify(updatedTeachers));
    } catch {}

    setDeletingGroup(null);
    showToast(`"${groupCode}" guruhi o‘chirildi (Talabalar guruhsiz holatga o‘tkazildi).`);
  };

  // Add Student (Group is optional)
  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !newStudentEmail.trim()) return;

    const isAssigned = Boolean(newStudentGroupCode && newStudentGroupCode !== "none");
    const targetGroup = isAssigned ? groups.find((g) => g.code === newStudentGroupCode) : null;

    const dirNames: Record<DirectionCode, string> = {
      software: "Dasturiy injiniring",
      computer: "Kompyuter injiniringi",
      ai: "Sun’iy intellekt",
    };

    const created: UniversityStudentItem = {
      id: `stu-${Date.now()}`,
      name: newStudentName.trim(),
      email: newStudentEmail.trim(),
      groupCode: targetGroup ? targetGroup.code : "",
      direction: targetGroup ? targetGroup.direction : newStudentDirection,
      directionName: targetGroup ? targetGroup.directionName : dirNames[newStudentDirection],
      course: targetGroup ? targetGroup.course : newStudentCourse,
      curatorName: targetGroup ? targetGroup.curatorName : "Biriktirilmagan",
      level: "L1",
      score: 55,
      status: "active",
    };

    const updatedStudents = [created, ...students];
    setStudents(updatedStudents);

    let updatedGroups = groups;
    if (targetGroup) {
      updatedGroups = groups.map((g) => {
        if (g.code === targetGroup.code) {
          return { ...g, studentsCount: g.studentsCount + 1 };
        }
        return g;
      });
      setGroups(updatedGroups);
    }

    try {
      localStorage.setItem("skill_dna_univ_students", JSON.stringify(updatedStudents));
      localStorage.setItem("skill_dna_univ_groups", JSON.stringify(updatedGroups));
    } catch {}

    setNewStudentName("");
    setNewStudentEmail("");
    setNewStudentGroupCode("none");
    setShowAddStudent(false);

    if (targetGroup) {
      showToast(`Talaba ${created.name} ro‘yxatga olindi va ${targetGroup.code} guruhiga kiritildi.`);
    } else {
      showToast(`Talaba ${created.name} ro‘yxatga olindi (Guruhsiz saqlandi, keyinchalik xohlagan guruhga biriktirish mumkin).`);
    }
  };

  // Assign or Reassign student to a group
  const handleAssignStudentToGroup = () => {
    if (!assigningStudent || !selectedGroupForStudent) return;
    const targetGroup = groups.find((g) => g.code === selectedGroupForStudent);
    if (!targetGroup) return;

    const prevGroupCode = assigningStudent.groupCode;

    const updatedStudents = students.map((s) => {
      if (s.id === assigningStudent.id) {
        return {
          ...s,
          groupCode: targetGroup.code,
          direction: targetGroup.direction,
          directionName: targetGroup.directionName,
          course: targetGroup.course,
          curatorName: targetGroup.curatorName,
        };
      }
      return s;
    });
    setStudents(updatedStudents);

    const updatedGroups = groups.map((g) => {
      if (g.code === targetGroup.code) {
        return { ...g, studentsCount: g.studentsCount + 1 };
      }
      if (prevGroupCode && g.code === prevGroupCode && g.studentsCount > 0) {
        return { ...g, studentsCount: g.studentsCount - 1 };
      }
      return g;
    });
    setGroups(updatedGroups);

    try {
      localStorage.setItem("skill_dna_univ_students", JSON.stringify(updatedStudents));
      localStorage.setItem("skill_dna_univ_groups", JSON.stringify(updatedGroups));
    } catch {}

    showToast(`${assigningStudent.name} muvaffaqiyatli ${targetGroup.code} (${targetGroup.curatorName}) guruhiga biriktirildi.`);
    setAssigningStudent(null);
  };

  // Open Edit Student modal
  const handleOpenEditStudent = (student: UniversityStudentItem) => {
    setEditingStudent(student);
    setEditStudentName(student.name);
    setEditStudentEmail(student.email);
    setEditStudentGroupCode(student.groupCode || "none");
    setEditStudentDirection(student.direction);
    setEditStudentCourse(student.course);
    setEditStudentLevel(student.level);
    setEditStudentScore(student.score);
  };

  // Update Student
  const handleUpdateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !editStudentName.trim() || !editStudentEmail.trim()) return;

    const dirNames: Record<DirectionCode, string> = {
      software: "Dasturiy injiniring",
      computer: "Kompyuter injiniringi",
      ai: "Sun’iy intellekt",
    };

    const oldGroupCode = editingStudent.groupCode;
    const isAssigned = Boolean(editStudentGroupCode && editStudentGroupCode !== "none");
    const targetGroup = isAssigned ? groups.find((g) => g.code === editStudentGroupCode) : null;
    const newGroupCode = targetGroup ? targetGroup.code : "";

    const updatedStudents = students.map((s) => {
      if (s.id === editingStudent.id) {
        return {
          ...s,
          name: editStudentName.trim(),
          email: editStudentEmail.trim(),
          groupCode: newGroupCode,
          direction: targetGroup ? targetGroup.direction : editStudentDirection,
          directionName: targetGroup ? targetGroup.directionName : dirNames[editStudentDirection],
          course: targetGroup ? targetGroup.course : editStudentCourse,
          curatorName: targetGroup ? targetGroup.curatorName : "Biriktirilmagan",
          level: editStudentLevel,
          score: Number(editStudentScore) || 50,
        };
      }
      return s;
    });
    setStudents(updatedStudents);

    // If group changed, update student counts in affected groups
    if (oldGroupCode !== newGroupCode) {
      const updatedGroups = groups.map((g) => {
        if (targetGroup && g.code === targetGroup.code) {
          return { ...g, studentsCount: g.studentsCount + 1 };
        }
        if (oldGroupCode && g.code === oldGroupCode && g.studentsCount > 0) {
          return { ...g, studentsCount: g.studentsCount - 1 };
        }
        return g;
      });
      setGroups(updatedGroups);
      try {
        localStorage.setItem("skill_dna_univ_groups", JSON.stringify(updatedGroups));
      } catch {}
    }

    try {
      localStorage.setItem("skill_dna_univ_students", JSON.stringify(updatedStudents));
    } catch {}

    const name = editStudentName.trim();
    setEditingStudent(null);
    showToast(`Talaba "${name}" ma’lumotlari muvaffaqiyatli yangilandi.`);
  };

  // Delete Student
  const handleDeleteStudent = () => {
    if (!deletingStudent) return;

    const studentName = deletingStudent.name;
    const updatedStudents = students.filter((s) => s.id !== deletingStudent.id);
    setStudents(updatedStudents);

    // Decrement group students count if student had a group
    if (deletingStudent.groupCode) {
      const updatedGroups = groups.map((g) => {
        if (g.code === deletingStudent.groupCode && g.studentsCount > 0) {
          return { ...g, studentsCount: g.studentsCount - 1 };
        }
        return g;
      });
      setGroups(updatedGroups);
      try {
        localStorage.setItem("skill_dna_univ_groups", JSON.stringify(updatedGroups));
      } catch {}
    }

    try {
      localStorage.setItem("skill_dna_univ_students", JSON.stringify(updatedStudents));
    } catch {}

    setDeletingStudent(null);
    showToast(`Talaba "${studentName}" ro‘yxatdan o‘chirildi.`);
  };

  // Filtered Students
  const unassignedStudentsCount = students.filter((s) => !s.groupCode || s.groupCode === "none").length;

  const filteredStudents = students.filter((s) => {
    let matchGroup = true;
    if (studentFilterGroup === "all") {
      matchGroup = true;
    } else if (studentFilterGroup === "unassigned") {
      matchGroup = !s.groupCode || s.groupCode === "none";
    } else {
      matchGroup = s.groupCode === studentFilterGroup;
    }

    const matchSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.groupCode && s.groupCode.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchGroup && matchSearch;
  });

  // ---------------------------------------------------------------------------
  // Live data: analytics (KPIs, directions, levels, curriculum gaps) + groups
  // ---------------------------------------------------------------------------
  const [analytics, setAnalytics] = useState<LiveAnalytics | null>(null);
  const [analyticsStatus, setAnalyticsStatus] = useState<DataStatus>(() => (hasSession() ? "loading" : "demo"));
  const [orgName, setOrgName] = useState<string | null>(null);
  const [liveGroups, setLiveGroups] = useState<LiveGroup[] | null>(null);
  const [groupsStatus, setGroupsStatus] = useState<DataStatus>(() => (hasSession() ? "loading" : "demo"));
  const [selectedLiveGroup, setSelectedLiveGroup] = useState<string | null>(null);
  const [groupGaps, setGroupGaps] = useState<LiveGroupGaps | null>(null);
  const [groupGapsLoading, setGroupGapsLoading] = useState(false);
  const [groupGapsError, setGroupGapsError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSession()) return;
    let cancelled = false;
    api
      .getUniversityAnalytics()
      .then((data: LiveAnalytics) => {
        if (cancelled) return;
        if (data && typeof data.students_total === "number" && Array.isArray(data.directions)) {
          setAnalytics(data);
          setAnalyticsStatus("live");
        } else {
          setAnalyticsStatus("demo");
        }
      })
      .catch(() => {
        if (!cancelled) setAnalyticsStatus("demo");
      });
    api
      .getTeacherGroups()
      .then((data: LiveGroup[]) => {
        if (cancelled) return;
        if (Array.isArray(data)) {
          setLiveGroups(data);
          setGroupsStatus("live");
        } else {
          setGroupsStatus("demo");
        }
      })
      .catch(() => {
        if (!cancelled) setGroupsStatus("demo");
      });
    api
      .getMe()
      .then((me: any) => {
        if (!cancelled && me && me.role === "university" && typeof me.organization === "string" && me.organization) {
          setOrgName(me.organization);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const openLiveGroup = (groupId: string) => {
    if (selectedLiveGroup === groupId) {
      setSelectedLiveGroup(null);
      setGroupGaps(null);
      return;
    }
    setSelectedLiveGroup(groupId);
    setGroupGaps(null);
    setGroupGapsError(null);
    setGroupGapsLoading(true);
    api
      .getGroupGaps(groupId)
      .then((data: LiveGroupGaps) => setGroupGaps(data))
      .catch((err: any) => setGroupGapsError(err?.message || "Guruh tahlilini yuklab bo‘lmadi."))
      .finally(() => setGroupGapsLoading(false));
  };

  const isLive = analyticsStatus === "live" && analytics !== null;
  const groupsLive = groupsStatus === "live" && liveGroups !== null;

  // Normalised views (live -> API, demo -> bundled sample data)
  const directionViews: DirectionView[] = isLive
    ? analytics!.directions.map((d) => ({
        key: d.code,
        name: d.name,
        students: d.students,
        avgScore: d.avg_score,
        avgConfidence: d.avg_confidence,
        readinessPct: null,
        courses:
          Object.entries(d.courses || {})
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([c, n]) => `${c}: ${n}`)
            .join(" · ") || null,
      }))
    : universityAnalyticsData.directionStats.map((d) => ({
        key: d.name,
        name: d.name,
        students: d.students,
        avgScore: d.avgScore,
        avgConfidence: d.avgConfidence,
        readinessPct: d.readinessPct,
        courses: null,
      }));

  const levelTotal = isLive
    ? Object.values(analytics!.level_distribution || {}).reduce((a, b) => a + (b || 0), 0)
    : 0;
  const levelViews: LevelView[] = isLive
    ? ["L0", "L1", "L2", "L3", "L4", "L5"].map((k) => {
        const count = analytics!.level_distribution?.[k] ?? 0;
        return { level: LEVEL_LABELS[k], count, pct: formatPct(count, levelTotal) };
      })
    : universityAnalyticsData.levelDistribution;

  const gapViews: GapView[] = isLive
    ? analytics!.curriculum_gaps.map((g) => ({
        key: g.code,
        direction: g.code,
        skill: g.skill,
        badge: `${g.below_70_pct}% talaba 70 balldan past`,
        recommendation: null,
        meta: `O‘rtacha ball: ${g.avg_score} / 100 · Baholangan talabalar: ${g.students} nafar`,
        severe: g.below_70_pct > 0 || g.avg_score < 70,
      }))
    : universityAnalyticsData.curriculumGaps.map((g) => ({
        key: g.skill,
        direction: g.direction,
        skill: g.skill,
        badge: `${g.shortfallPct} yetishmovchilik`,
        recommendation: g.recommendation,
        meta: null,
        severe: true,
      }));

  // KPI values; "—" where the API provides nothing. Several scored directions -> student-weighted mean marked with "≈".
  const weightedMean = (field: "avg_score" | "avg_confidence"): string | null => {
    if (!isLive) return null;
    const rows = analytics!.directions.filter((d) => d[field] !== null && d[field] !== undefined);
    if (!rows.length) return null;
    if (rows.length === 1) return String(rows[0][field]);
    const w = rows.reduce((a, d) => a + d.students, 0);
    if (!w) return null;
    return `≈${(rows.reduce((a, d) => a + (d[field] as number) * d.students, 0) / w).toFixed(1)}`;
  };
  const liveScore = weightedMean("avg_score");
  const liveConfidence = weightedMean("avg_confidence");
  const kpiStudents = isLive
    ? `${analytics!.students_total.toLocaleString()} nafar`
    : `${universityAnalyticsData.activeStudents.toLocaleString()} nafar`;
  const kpiScore = isLive ? (liveScore ? `${liveScore} / 100` : "—") : `${universityAnalyticsData.averageSkillScore} / 100`;
  const kpiConfidence = isLive ? (liveConfidence ? `${liveConfidence}%` : "—") : `${universityAnalyticsData.averageConfidence}%`;

  // Per-tab data provenance shown in the page header
  const tabStatus: DataStatus =
    activeTab === "dashboard" || activeTab === "analytics" || activeTab === "curriculum" || activeTab === "levels"
      ? analyticsStatus
      : activeTab === "groups"
      ? groupsStatus
      : "demo";

  const renderDirectionsAndLevels = () => (
    <div className="summary-grid" style={{ marginBottom: "26px" }}>
      {/* Direction analytics */}
      <section className="card" style={{ padding: "26px" }}>
        <div className="card-heading" style={{ marginBottom: "16px" }}>
          <div>
            <p className="card-kicker">FAKULTETLAR VA PILOT YO‘NALISHLARI</p>
            <h2>Yo‘nalishlar kesimida natijadorlik</h2>
          </div>
          <span className="level-badge">{isLive ? `${directionViews.length} ta yo‘nalish` : "3 ta pilot yo‘nalish"}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {directionViews.length === 0 && (
            <p style={{ margin: 0, fontSize: "13.5px", color: "var(--muted)" }}>Hozircha talabalar ma’lumotlari yo‘q.</p>
          )}
          {directionViews.map((item) => (
            <div
              key={item.key}
              style={{
                padding: "16px",
                borderRadius: "10px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: "8px",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <strong style={{ fontSize: "15px", color: "var(--navy)" }}>{item.name}</strong>
                  <span style={{ fontSize: "13px", color: "var(--muted)", marginLeft: "8px" }}>({item.students} talaba)</span>
                </div>
                <strong style={{ fontSize: "15.5px", color: "var(--royal)" }}>
                  {item.avgScore ?? "—"} ball · {item.avgConfidence !== null ? `${item.avgConfidence}%` : "—"} ishonch
                </strong>
              </div>

              {item.courses && (
                <div style={{ fontSize: "12.5px", color: "var(--muted)", marginBottom: "8px" }}>Kurslar: {item.courses}</div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="progress-track" style={{ flex: 1, height: "8px", margin: 0 }}>
                  <div
                    style={{
                      width: `${item.readinessPct ?? item.avgScore ?? 0}%`,
                      height: "100%",
                      borderRadius: "10px",
                      background: "linear-gradient(90deg, var(--accent), var(--accent-400))",
                    }}
                  />
                </div>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--navy)", width: "135px", textAlign: "right" }}>
                  {item.readinessPct !== null
                    ? `Bozorga tayyorlik: ${item.readinessPct}%`
                    : `O‘rtacha ball: ${item.avgScore ?? "—"}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Level Distribution */}
      <aside className="card" style={{ padding: "26px" }}>
        <div className="card-heading" style={{ marginBottom: "16px" }}>
          <div>
            <p className="card-kicker">MALAKA IYERARXIYASI</p>
            <h2>{isLive ? "L0–L5 Darajalar taqsimoti" : "L1–L5 Darajalar taqsimoti"}</h2>
          </div>
        </div>
        <p style={{ fontSize: "13.5px", color: "var(--muted)", marginBottom: "16px" }}>
          {isLive
            ? `Talabalarning eng yuqori ko‘nikma darajasi bo‘yicha taqsimlanishi (${levelTotal} nafar):`
            : "Talabalarning amaliy ko‘nikma darajalari bo‘yicha taqsimlanishi:"}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {levelViews.map((lvl) => (
            <div key={lvl.level}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13.5px", marginBottom: "4px" }}>
                <strong>{lvl.level}</strong>
                <span>
                  {lvl.count} nafar ({lvl.pct})
                </span>
              </div>
              <div className="progress-track" style={{ height: "6px", margin: 0 }}>
                <div
                  style={{
                    width: lvl.pct,
                    height: "100%",
                    borderRadius: "10px",
                    background: lvl.level.includes("L5")
                      ? "#ec4899"
                      : lvl.level.includes("L4")
                      ? "var(--success-400)"
                      : lvl.level.includes("L3")
                      ? "var(--accent-400)"
                      : lvl.level.includes("L2")
                      ? "var(--warning-400)"
                      : "var(--subtle)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );

  const renderGapGrid = (variant: "compact" | "full") => {
    if (gapViews.length === 0) {
      return (
        <p style={{ margin: 0, fontSize: "13.5px", color: "var(--muted)" }}>
          Hozircha baholangan ko‘nikmalar yo‘q — "oq dog‘lar" aniqlanmadi.
        </p>
      );
    }
    const full = variant === "full";
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(${full ? 340 : 320}px, 1fr))`,
          gap: "16px",
        }}
      >
        {gapViews.map((gap) => (
          <div
            key={gap.key}
            className={full ? "card" : undefined}
            style={{
              padding: full ? "22px" : "20px",
              borderRadius: "12px",
              border: full && gap.severe ? "1px solid var(--danger-ring)" : "1px solid var(--border)",
              background: gap.severe ? "var(--danger-soft)" : "var(--surface-2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: full ? "10px" : "8px",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "12px", fontWeight: 800, color: full && gap.severe ? "var(--danger-fg)" : "var(--muted)" }}>
                {gap.direction}
              </span>
              <span
                style={{
                  padding: full ? "4px 10px" : "4px 9px",
                  borderRadius: "12px",
                  background: gap.severe ? "var(--danger-soft)" : "var(--surface-3)",
                  color: gap.severe ? "var(--danger)" : "var(--text-3)",
                  fontSize: "12.5px",
                  fontWeight: 800,
                }}
              >
                {gap.badge}
              </span>
            </div>
            <h3 style={{ margin: "4px 0 8px", fontSize: full ? "18px" : "17px", color: "var(--navy)" }}>{gap.skill}</h3>
            {gap.meta && (
              <p style={{ margin: 0, fontSize: "13.5px", color: "var(--text-3)", lineHeight: full ? "1.6" : "1.5" }}>{gap.meta}</p>
            )}
            {gap.recommendation && (
              <p style={{ margin: 0, fontSize: "13.5px", color: "var(--text-3)", lineHeight: full ? "1.6" : "1.5" }}>
                <strong>{full ? "AI Tavsiyasi:" : "Tavsiya:"}</strong> {gap.recommendation}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderGapsSection = () => (
    <section className="card" style={{ padding: "26px" }}>
      <div className="card-heading" style={{ marginBottom: "18px" }}>
        <div>
          <p className="card-kicker">O‘QUV DASTURI TAVSIYALARI</p>
          <h2>Aniqlangan "Oq dog‘lar" va o‘quv rejasi yangilanishlari</h2>
        </div>
        <span className="level-badge">{isLive ? "Eng past o‘rtacha ballli ko‘nikmalar" : "AI Tahlil natijasi"}</span>
      </div>
      {renderGapGrid("compact")}
    </section>
  );

  const renderLiveGroupsPanel = () => {
    if (!groupsLive) return null;
    return (
      <div className="card" style={{ padding: "22px", marginBottom: "22px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "14px",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div>
            <p className="card-kicker">SERVERDAGI GURUHLAR · KO‘NIKMA TAHLILI</p>
            <h3 style={{ margin: "4px 0 0", fontSize: "17px", color: "var(--navy)" }}>
              Tashkilotingiz guruhlari ({liveGroups!.length} ta)
            </h3>
          </div>
          <DataBadge status="live" />
        </div>
        {liveGroups!.length === 0 ? (
          <p style={{ margin: 0, fontSize: "13.5px", color: "var(--muted)" }}>Hozircha guruhlarga biriktirilgan talabalar yo‘q.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
            {liveGroups!.map((g) => {
              const active = selectedLiveGroup === g.group_id;
              return (
                <button
                  key={g.group_id}
                  onClick={() => openLiveGroup(g.group_id)}
                  style={{
                    textAlign: "left",
                    padding: "14px",
                    borderRadius: "10px",
                    background: active ? "var(--accent-soft)" : "var(--surface-2)",
                    border: active ? "1px solid var(--royal)" : "1px solid var(--border)",
                    cursor: "pointer",
                    font: "inherit",
                  }}
                >
                  <strong style={{ fontSize: "15px", color: "var(--navy)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <Icon name="users" size={15} /> {g.group_id}
                  </strong>
                  <div style={{ fontSize: "12.5px", color: "var(--muted)", marginTop: "6px" }}>
                    Talabalar: <strong style={{ color: "var(--navy)" }}>{g.students} nafar</strong>
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--royal)", marginTop: "6px", fontWeight: 700 }}>
                    {active ? "Tahlilni yopish ↑" : "Ko‘nikma tahlili →"}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selectedLiveGroup && (
          <div style={{ marginTop: "18px", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
            {groupGapsLoading && <p style={{ margin: 0, fontSize: "13.5px", color: "var(--muted)" }}>Yuklanmoqda…</p>}
            {groupGapsError && <p style={{ margin: 0, fontSize: "13.5px", color: "var(--danger)" }}>{groupGapsError}</p>}
            {groupGaps && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "18px" }}>
                <div>
                  <h4 style={{ margin: "0 0 10px", fontSize: "14.5px", color: "var(--navy)" }}>
                    Ko‘nikmalar bo‘yicha bo‘shliqlar ({groupGaps.group_id})
                  </h4>
                  {groupGaps.skills.length === 0 ? (
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>Bu guruhda hali baholangan ko‘nikmalar yo‘q.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {groupGaps.skills.map((sk) => (
                        <div
                          key={sk.skill.id}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "8px",
                            background: sk.gap_pct > 0 ? "var(--danger-soft)" : "var(--surface-2)",
                            border: "1px solid var(--border)",
                            fontSize: "13px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                            <strong style={{ color: "var(--navy)" }}>{sk.skill.name}</strong>
                            <span style={{ fontWeight: 700, color: "var(--royal)" }}>{sk.avg_score} ball</span>
                          </div>
                          <div style={{ color: "var(--muted)", fontSize: "12px", marginTop: "3px" }}>
                            {sk.skill.code} · {sk.students_scored} nafar baholangan · {sk.gap_pct}% 70 balldan past
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h4 style={{ margin: "0 0 10px", fontSize: "14.5px", color: "var(--navy)" }}>
                    Talabalar ({groupGaps.students_total} nafar)
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {groupGaps.students.map((st) => (
                      <div
                        key={st.id}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "8px",
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                          fontSize: "13px",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "8px",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ color: "var(--navy)" }}>{st.name}</strong>
                          <div style={{ color: "var(--muted)", fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis" }}>{st.email}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <span className="level-badge">{st.level}</span>
                          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "3px" }}>
                            {st.skills_scored > 0 ? `${st.score} ball · ${st.skills_scored} ko‘nikma` : "Hali baholanmagan"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page" style={{ maxWidth: "1280px", margin: "0 auto", paddingBottom: "60px" }}>
      {/* Page Header */}
      <section className="welcome-row" style={{ alignItems: "flex-start", marginBottom: "20px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "var(--royal)",
                background: "rgba(30, 58, 138, 0.1)",
                padding: "3px 8px",
                borderRadius: "5px",
                letterSpacing: "0.08em",
              }}
            >
              BSTU AKADEMIK DEKANATI · UNIVERSITY SUITE
            </span>
            <DataBadge status={tabStatus} />
          </div>
          <h1 style={{ fontSize: "28px", fontWeight: 800, color: "var(--navy)", margin: "0 0 6px" }}>
            {orgName ?? universityAnalyticsData.universityName}
          </h1>
          <p className="subtitle" style={{ margin: 0, fontSize: "14.5px", color: "var(--muted)" }}>
            O‘qituvchilar, akademik guruhlar, talabalar kontingenti va ta’lim natijadorligini yagona markazdan boshqarish.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>


          <button
            className="primary-button"
            onClick={handleDownload}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "9px 16px",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "13.5px",
            }}
          >
            {downloaded ? (
              <>
                <Icon name="check" size={16} /> Hisobot olindi!
              </>
            ) : (
              <>
                <Icon name="download" size={16} /> Rektorat hisoboti (PDF)
              </>
            )}
          </button>
        </div>
      </section>



      {/* TAB 1: WORKFLOW & STRUCTURAL SEQUENCE */}
      {activeTab === "workflow" && (
        <div>
          {/* Architecture sequence hero banner */}
          <div
            className="card"
            style={{
              padding: "26px",
              background: "linear-gradient(160deg, #1e3a8a 0%, #0f2744 100%)",
              color: "var(--surface-2)",
              borderRadius: "14px",
              marginBottom: "24px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <span
                  style={{
                    background: "rgba(56, 189, 248, 0.15)",
                    color: "var(--info-400)",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                  }}
                >
                  ARXITEKTURA VA BOSQICHMA-BOSQICH STANDART
                </span>
                <h2 style={{ fontSize: "22px", margin: "10px 0 6px", color: "white" }}>
                  Universitet Ma’lumotlar Oqimi va Ketma-ketlik Zanjiri
                </h2>
                <p style={{ margin: 0, fontSize: "14px", color: "var(--subtle)", maxWidth: "760px", lineHeight: "1.5" }}>
                  To‘g‘ri akademik ketma-ketlik ma’lumotlar yaxlitligini ta’minlaydi: har bir talaba guruh orqali
                  o‘qituvchiga, o‘qituvchi esa kafedra va fan kompetensiyalariga mustahkam bog‘lanadi.
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => setShowAddTeacher(true)}
                  style={{
                    background: "rgba(255, 255, 255, 0.1)",
                    color: "white",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    borderRadius: "8px",
                    padding: "8px 14px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  + O‘qituvchi kiritish
                </button>
                <button
                  onClick={handleOpenAddGroup}
                  style={{
                    background: "var(--accent)",
                    color: "white",
                    border: 0,
                    borderRadius: "8px",
                    padding: "8px 16px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  + Guruh yaratish
                </button>
              </div>
            </div>

            {/* Visual 4-Step Pipeline */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                gap: "14px",
                marginTop: "24px",
              }}
            >
              {/* Step 1 */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "10px",
                  padding: "16px",
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--info-400)" }}>1-BOSQICH</span>
                  <span style={{ fontSize: "11px", background: "var(--success-400)", color: "white", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>Mavjud</span>
                </div>
                <strong style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "15px", color: "white", marginBottom: "4px" }}>
                  <Icon name="university" size={17} /> Ta’lim Yo‘nalishlari
                </strong>
                <p style={{ margin: 0, fontSize: "12.5px", color: "var(--subtle)", lineHeight: "1.4" }}>
                  Dasturiy injiniring, AI, Kompyuter injiniringi. Yo‘nalishlar o‘quv rejasi va ontologiyani belgilaydi.
                </p>
              </div>

              {/* Step 2 */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "10px",
                  padding: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--info-400)" }}>2-BOSQICH</span>
                  <span style={{ fontSize: "11px", color: "var(--border)", fontWeight: 700 }}>{teachers.length} nafar faol</span>
                </div>
                <strong style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "15px", color: "white", marginBottom: "4px" }}>
                  <Icon name="teacher" size={17} /> O‘qituvchilar Bazasi
                </strong>
                <p style={{ margin: 0, fontSize: "12.5px", color: "var(--subtle)", lineHeight: "1.4" }}>
                  Admin o‘qituvchilarni yo‘nalish va kafedrasiga ko‘ra ro‘yxatga oladi. Ular guruhlarga kurator bo‘ladi.
                </p>
              </div>

              {/* Step 3 */}
              <div
                style={{
                  background: "rgba(30, 58, 138, 0.12)",
                  border: "1px solid rgba(30, 58, 138, 0.35)",
                  borderRadius: "10px",
                  padding: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--accent-ring)" }}>3-BOSQICH</span>
                  <span style={{ fontSize: "11px", background: "var(--accent)", color: "white", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>Bog‘lovchi</span>
                </div>
                <strong style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "15px", color: "white", marginBottom: "4px" }}>
                  <Icon name="users" size={17} /> Guruh Ochish & Biriktirish
                </strong>
                <p style={{ margin: 0, fontSize: "12.5px", color: "var(--accent-ring)", lineHeight: "1.4" }}>
                  Guruh yaratilgach, unga yo‘nalish va <strong>mas’ul o‘qituvchi</strong> darhol biriktiriladi.
                </p>
              </div>

              {/* Step 4 */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "10px",
                  padding: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--info-400)" }}>4-BOSQICH</span>
                  <span style={{ fontSize: "11px", color: "var(--border)", fontWeight: 700 }}>{students.length} nafar</span>
                </div>
                <strong style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "15px", color: "white", marginBottom: "4px" }}>
                  <Icon name="student" size={17} /> Talabalarni Joylashtirish
                </strong>
                <p style={{ margin: 0, fontSize: "12.5px", color: "var(--subtle)", lineHeight: "1.4" }}>
                  Talaba kiritilganda uning guruhi tanlanadi. Talaba avtomatik o‘sha guruh o‘qituvchisiga birikadi.
                </p>
              </div>
            </div>
          </div>

          {/* Detailed Sequence Explanation Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div className="card" style={{ padding: "22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.1)", color: "var(--success-400)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="check" size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", color: "var(--navy)" }}>
                    Nega "O‘qituvchi → Guruh → Talaba" ketma-ketligi eng to‘g‘ri?
                  </h3>
                  <span style={{ fontSize: "12.5px", color: "var(--muted)" }}>Tizim yaxlitligi va qulaylik tahlili</span>
                </div>
              </div>

              <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13.5px", color: "var(--text-3)", lineHeight: "1.6" }}>
                <li style={{ marginBottom: "8px" }}>
                  <strong>Guruh yaratilayotganda o‘qituvchi tayyor bo‘ladi:</strong> Guruh ochish modalida mas’ul kuratorni ro‘yxatdan tanlash mumkin bo‘ladi.
                </li>
                <li style={{ marginBottom: "8px" }}>
                  <strong>Talaba guruhsiz qolmaydi:</strong> Talabani kiritishda unga tayyor guruh belgilanadi, talaba kirishi bilanoq o‘z fanlarini va o‘qituvchisini ko‘radi.
                </li>
                <li style={{ marginBottom: "8px" }}>
                  <strong>O‘qituvchi kabineti (`TeacherPortal`):</strong> O‘qituvchi o‘z portaliga kirishi bilan aynan unga biriktirilgan guruh talabalari matritsasini tahlil qila oladi.
                </li>
              </ul>
            </div>

            <div className="card" style={{ padding: "22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(30, 58, 138, 0.1)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="refresh" size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", color: "var(--navy)" }}>
                    Moslashuvchanlik: Guruhni istalgan payt qayta biriktirish
                  </h3>
                  <span style={{ fontSize: "12.5px", color: "var(--muted)" }}>Dinamik boshqaruv imkoniyatlari</span>
                </div>
              </div>

              <p style={{ fontSize: "13.5px", color: "var(--text-3)", lineHeight: "1.5", margin: "0 0 12px" }}>
                Platforma qat’iy cheklov qo‘ymaydi. Agar o‘qituvchi o‘zgarsa yoki talaba boshqa guruhga o‘tsa:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ padding: "10px", borderRadius: "8px", background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: "13px" }}>
                  <span style={{ color: "var(--royal)", fontWeight: 800, marginRight: "6px" }}>•</span>
                  <strong>Guruh o‘qituvchisini almashtirish:</strong> "Guruhlar" bo‘limida istalgan guruhning "O‘qituvchini o‘zgartirish" tugmasini bosish kifoya.
                </div>
                <div style={{ padding: "10px", borderRadius: "8px", background: "var(--surface-2)", border: "1px solid var(--border)", fontSize: "13px" }}>
                  <span style={{ color: "var(--royal)", fontWeight: 800, marginRight: "6px" }}>•</span>
                  <strong>Talabani boshqa guruhga ko‘chirish:</strong> Talabaning guruhi o‘zgarganda, uning yangi kuratori va fanlar jadvali avtomatik moslashadi.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TEACHERS MANAGEMENT */}
      {activeTab === "teachers" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--navy)", margin: 0 }}>
                O‘qituvchilar va Kafedra Professor-o‘qituvchilari
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "13.5px", color: "var(--muted)" }}>
                Kafedra mudirlari, professorlar va guruhlarga biriktirilgan lektorlar ro‘yxati.
              </p>
            </div>

            <button
              className="primary-button"
              onClick={() => setShowAddTeacher(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Icon name="user" size={16} /> Yangi o‘qituvchi qo‘shish
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: "16px" }}>
            {teachers.map((t) => (
              <div
                key={t.id}
                className="card"
                style={{
                  padding: "20px",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "14px" }}>
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "10px",
                        background: "linear-gradient(135deg, var(--accent), var(--accent-hover))",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: "15px",
                        flexShrink: 0,
                      }}
                    >
                      {t.avatar}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ fontSize: "15.5px", color: "var(--navy)", display: "block" }}>{t.name}</strong>
                      <span style={{ fontSize: "12.5px", color: "var(--muted)", display: "block" }}>{t.title}</span>
                      <span style={{ fontSize: "12px", color: "var(--royal)", fontWeight: 700 }}>{t.department}</span>
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                      <button
                        onClick={() => handleOpenEditTeacher(t)}
                        title="O‘qituvchini tahrirlash"
                        style={{
                          border: "1px solid var(--border-strong)",
                          background: "var(--surface-2)",
                          borderRadius: "6px",
                          width: "32px",
                          height: "32px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "var(--text-2)",
                        }}
                      >
                        <Icon name="edit" size={14} />
                      </button>
                      <button
                        onClick={() => setDeletingTeacher(t)}
                        title="O‘qituvchini o‘chirish"
                        style={{
                          border: "1px solid var(--danger-ring)",
                          background: "var(--rose-soft)",
                          borderRadius: "6px",
                          width: "32px",
                          height: "32px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "var(--rose)",
                        }}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px", marginBottom: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", color: "var(--text-3)", marginBottom: "6px" }}>
                      <span>Email:</span>
                      <strong style={{ color: "var(--navy)" }}>{t.email}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", color: "var(--text-3)", marginBottom: "6px" }}>
                      <span>Telefon:</span>
                      <span>{t.phone}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", color: "var(--text-3)" }}>
                      <span>Yo‘nalishi:</span>
                      <span className="level-badge">{t.directionName}</span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: "11.5px", fontWeight: 800, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
                      BIRIKTIRILGAN AKADEMIK GURUHLAR ({t.assignedGroups.length}):
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {t.assignedGroups.length > 0 ? (
                        t.assignedGroups.map((g) => (
                          <span
                            key={g}
                            style={{
                              padding: "3px 8px",
                              borderRadius: "6px",
                              background: "rgba(30, 58, 138, 0.1)",
                              color: "var(--royal)",
                              fontSize: "12px",
                              fontWeight: 700,
                              border: "1px solid rgba(30, 58, 138, 0.2)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Icon name="users" size={12} /> {g}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: "12px", color: "var(--subtle)", fontStyle: "italic" }}>
                          Hozircha guruh biriktirilmagan
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => {
                      setShowAddGroup(true);
                      setNewGroupCuratorId(t.id);
                    }}
                    style={{
                      background: "transparent",
                      border: 0,
                      color: "var(--royal)",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    + Guruh ochib biriktirish <Icon name="arrow" size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: GROUPS & ASSIGNMENTS */}
      {activeTab === "groups" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--navy)", margin: 0 }}>
                Akademik Guruhlar va O‘qituvchilar Biriktiruvi
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "13.5px", color: "var(--muted)" }}>
                Har bir guruhning kursi, mas’ul o‘qituvchisi va talabalar kontingenti.
              </p>
            </div>

            <button
              className="primary-button"
              onClick={handleOpenAddGroup}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Icon name="users" size={16} /> Yangi guruh ochish
            </button>
          </div>

          {renderLiveGroupsPanel()}

          {groupsLive && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "0 0 12px" }}>
              <h3 style={{ margin: 0, fontSize: "15px", color: "var(--navy)" }}>Mahalliy guruhlar ro‘yxati (kurator biriktiruvi)</h3>
              <DataBadge status="demo" />
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "16px" }}>
            {groups.map((g) => (
              <div
                key={g.id}
                className="card"
                style={{
                  padding: "20px",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "8px",
                          background: "var(--accent-soft)",
                          color: "var(--royal)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon name="users" size={16} />
                      </span>
                      <strong style={{ fontSize: "18px", color: "var(--navy)" }}>{g.code}</strong>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "12px",
                          background: "var(--surface-3)",
                          color: "var(--text-3)",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      >
                        {g.course}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                      <button
                        onClick={() => handleOpenEditGroup(g)}
                        title="Guruhni tahrirlash"
                        style={{
                          border: "1px solid var(--border-strong)",
                          background: "var(--surface-2)",
                          borderRadius: "6px",
                          width: "30px",
                          height: "30px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "var(--text-2)",
                        }}
                      >
                        <Icon name="edit" size={13} />
                      </button>
                      <button
                        onClick={() => setDeletingGroup(g)}
                        title="Guruhni o‘chirish"
                        style={{
                          border: "1px solid var(--danger-ring)",
                          background: "var(--rose-soft)",
                          borderRadius: "6px",
                          width: "30px",
                          height: "30px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "var(--rose)",
                        }}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  </div>

                  <p style={{ margin: "0 0 14px", fontSize: "13px", color: "var(--muted)" }}>
                    Yo‘nalish: <strong style={{ color: "var(--navy)" }}>{g.directionName}</strong>
                  </p>

                  <div
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      marginBottom: "14px",
                    }}
                  >
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--muted)", letterSpacing: "0.05em", display: "block", marginBottom: "4px" }}>
                      MAS’UL O‘QITUVCHI (KURATOR):
                    </span>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      {g.curatorId && g.curatorName && g.curatorName !== "Biriktirilmagan" ? (
                        <>
                          <strong style={{ fontSize: "14px", color: "var(--navy)" }}>{g.curatorName}</strong>
                          <button
                            onClick={() => {
                              setAssigningGroup(g);
                              setSelectedCuratorForGroup(g.curatorId);
                            }}
                            style={{
                              border: 0,
                              background: "transparent",
                              color: "var(--royal)",
                              fontSize: "12.5px",
                              fontWeight: 700,
                              cursor: "pointer",
                              textDecoration: "underline",
                            }}
                          >
                            O‘zgartirish
                          </button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontSize: "13px", color: "var(--warning-fg)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Icon name="clock" size={13} /> O‘qituvchi biriktirilmagan
                          </span>
                          <button
                            onClick={() => {
                              setAssigningGroup(g);
                              setSelectedCuratorForGroup(teachers[0]?.id || "");
                            }}
                            style={{
                              border: 0,
                              background: "transparent",
                              color: "var(--royal)",
                              fontSize: "12.5px",
                              fontWeight: 700,
                              cursor: "pointer",
                              textDecoration: "underline",
                            }}
                          >
                            + Biriktirish
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12.5px" }}>
                    <div style={{ padding: "8px", borderRadius: "6px", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                      <span style={{ color: "var(--muted)", display: "block" }}>Talabalar:</span>
                      <strong style={{ fontSize: "14px", color: "var(--navy)" }}>{g.studentsCount} nafar</strong>
                    </div>
                    <div style={{ padding: "8px", borderRadius: "6px", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                      <span style={{ color: "var(--muted)", display: "block" }}>O‘rtacha ko‘rsatkich:</span>
                      <strong style={{ fontSize: "14px", color: "var(--success-400)" }}>{g.avgScore ? `${g.avgScore} ball` : "Yangi"}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "var(--subtle)" }}>Ochilgan: {g.createdDate}</span>
                  <button
                    onClick={() => {
                      setStudentFilterGroup(g.code);
                      setActiveTab("students");
                    }}
                    style={{
                      background: "transparent",
                      border: 0,
                      color: "var(--royal)",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Talabalarni ko‘rish ({g.studentsCount}) →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: STUDENTS MANAGEMENT */}
      {activeTab === "students" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--navy)", margin: 0 }}>
                Talabalar Kontingenti va Guruhlarga Tasimoti
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "13.5px", color: "var(--muted)" }}>
                Talabalarning guruhlari, mas’ul o‘qituvchilari va 5 qatlamli amaliy malaka darajalari.
              </p>
            </div>

            <button
              className="primary-button"
              onClick={() => setShowAddStudent(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Icon name="dna" size={16} /> Yangi talaba kiritish
            </button>
          </div>

          {/* Filters Bar */}
          <div
            className="card"
            style={{
              padding: "14px 18px",
              marginBottom: "18px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: 1, minWidth: "220px", display: "flex", alignItems: "center", gap: "8px", background: "var(--surface-2)", padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
              <Icon name="search" size={16} />
              <input
                type="text"
                placeholder="Talaba ismi, email yoki guruhi bo‘yicha qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 0,
                  background: "transparent",
                  outline: "none",
                  width: "100%",
                  fontSize: "13.5px",
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--muted)" }}>Guruh:</span>
              <select
                value={studentFilterGroup}
                onChange={(e) => setStudentFilterGroup(e.target.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "7px",
                  border: "1px solid var(--border)",
                  background: "white",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <option value="all">Barcha talabalar ({students.length})</option>
                {unassignedStudentsCount > 0 && (
                  <option value="unassigned">Guruhga biriktirilmaganlar ({unassignedStudentsCount})</option>
                )}
                {groups.map((g) => (
                  <option key={g.code} value={g.code}>
                    {g.code} ({g.course})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Students Table */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13.5px" }}>
                <thead>
                  <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)", color: "var(--muted)", fontWeight: 700 }}>
                    <th style={{ padding: "12px 16px" }}>Talaba Ism-familiyasi</th>
                    <th style={{ padding: "12px 16px" }}>Akademik Guruh</th>
                    <th style={{ padding: "12px 16px" }}>Yo‘nalish</th>
                    <th style={{ padding: "12px 16px" }}>Mas’ul O‘qituvchi</th>
                    <th style={{ padding: "12px 16px" }}>Ko‘nikma bali</th>
                    <th style={{ padding: "12px 16px" }}>Holat & Amallar</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((s) => (
                      <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "12px 16px" }}>
                          <strong style={{ color: "var(--navy)", display: "block" }}>{s.name}</strong>
                          <span style={{ fontSize: "12px", color: "var(--muted)" }}>{s.email}</span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {s.groupCode && s.groupCode !== "none" ? (
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: "6px",
                                background: "var(--accent-soft)",
                                color: "var(--royal)",
                                fontWeight: 700,
                                fontSize: "12.5px",
                              }}
                            >
                              {s.groupCode}
                            </span>
                          ) : (
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: "6px",
                                background: "var(--warning-soft)",
                                color: "var(--warning-fg)",
                                fontWeight: 700,
                                fontSize: "12px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <Icon name="clock" size={12} /> Guruhsiz
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px", color: "var(--text-3)" }}>{s.directionName}</td>
                        <td style={{ padding: "12px 16px" }}>
                          {s.curatorName && s.curatorName !== "Biriktirilmagan" ? (
                            <span style={{ fontWeight: 600, color: "var(--navy)" }}>{s.curatorName}</span>
                          ) : (
                            <span style={{ color: "var(--subtle)", fontStyle: "italic", fontSize: "12.5px" }}>Biriktirilmagan</span>
                          )}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span className="level-badge">{s.level}</span>
                            <strong style={{ color: "var(--royal)" }}>{s.score} ball</strong>
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                            {s.groupCode && s.groupCode !== "none" ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span
                                  style={{
                                    padding: "2px 7px",
                                    borderRadius: "12px",
                                    background: "var(--success-soft)",
                                    color: "var(--success)",
                                    fontSize: "11.5px",
                                    fontWeight: 700,
                                  }}
                                >
                                  Faol
                                </span>
                                <button
                                  onClick={() => {
                                    setAssigningStudent(s);
                                    setSelectedGroupForStudent(s.groupCode);
                                  }}
                                  title="Guruhni o‘zgartirish"
                                  style={{
                                    border: 0,
                                    background: "transparent",
                                    color: "var(--royal)",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    textDecoration: "underline",
                                  }}
                                >
                                  O‘zgartirish
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span
                                  style={{
                                    padding: "2px 7px",
                                    borderRadius: "12px",
                                    background: "var(--warning-soft)",
                                    color: "var(--warning-fg)",
                                    fontSize: "11.5px",
                                    fontWeight: 700,
                                  }}
                                >
                                  Kutilmoqda
                                </span>
                                <button
                                  onClick={() => {
                                    setAssigningStudent(s);
                                    setSelectedGroupForStudent(groups[0]?.code || "");
                                  }}
                                  style={{
                                    border: "1px solid var(--border-strong)",
                                    background: "var(--surface-2)",
                                    color: "var(--navy)",
                                    padding: "2px 7px",
                                    borderRadius: "6px",
                                    fontSize: "11.5px",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  + Guruhga
                                </button>
                              </div>
                            )}

                            <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
                              <button
                                onClick={() => handleOpenEditStudent(s)}
                                title="Talabani tahrirlash"
                                style={{
                                  border: "1px solid var(--border-strong)",
                                  background: "var(--surface-2)",
                                  borderRadius: "6px",
                                  width: "28px",
                                  height: "28px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                  color: "var(--text-2)",
                                }}
                              >
                                <Icon name="edit" size={13} />
                              </button>
                              <button
                                onClick={() => setDeletingStudent(s)}
                                title="Talabani o‘chirish"
                                style={{
                                  border: "1px solid var(--danger-ring)",
                                  background: "var(--rose-soft)",
                                  borderRadius: "6px",
                                  width: "28px",
                                  height: "28px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                  color: "var(--rose)",
                                }}
                              >
                                <Icon name="trash" size={13} />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: "30px", textAlign: "center", color: "var(--muted)" }}>
                        Qidiruv bo‘yicha talabalar topilmadi.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: DASHBOARD & REAL STATUS OVERVIEW */}
      {(activeTab === "dashboard" || activeTab === "analytics") && (
        <div>
          {/* Top Level KPIs - 6 cards in 1 row */}
          <div
            className="task-overview"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
              gap: "10px",
              marginBottom: "26px",
            }}
          >
            <div className="card overview-stat" style={{ padding: "14px 12px", gap: "10px" }}>
              <div className="stat-icon blue" style={{ flexShrink: 0 }}>
                <Icon name="users" />
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: "11.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Faol talabalar</span>
                <strong style={{ fontSize: "17px", whiteSpace: "nowrap" }}>{kpiStudents}</strong>
              </div>
            </div>
            <div className="card overview-stat" style={{ padding: "14px 12px", gap: "10px" }}>
              <div className="stat-icon emerald" style={{ flexShrink: 0 }}>
                <Icon name="award" />
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: "11.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>O‘rtacha ball</span>
                <strong style={{ fontSize: "17px", whiteSpace: "nowrap" }}>{kpiScore}</strong>
              </div>
            </div>
            <div className="card overview-stat" style={{ padding: "14px 12px", gap: "10px" }}>
              <div className="stat-icon violet" style={{ flexShrink: 0 }}>
                <Icon name="shield" />
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: "11.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Ishonchlilik</span>
                <strong style={{ fontSize: "17px", whiteSpace: "nowrap" }}>{kpiConfidence}</strong>
              </div>
            </div>
            <div className="card overview-stat" style={{ padding: "14px 12px", gap: "10px" }}>
              <div className="stat-icon amber" style={{ flexShrink: 0 }}>
                <Icon name="award" />
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: "11.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{isLive ? "Ochiq shubhali holatlar" : "OB 3.0 Sertifikatlari"}</span>
                <strong style={{ fontSize: "17px", whiteSpace: "nowrap" }}>{isLive ? `${analytics!.open_flags} ta` : `${universityAnalyticsData.verifiedCredentialsIssued} ta`}</strong>
              </div>
            </div>
            <div className="card overview-stat" style={{ padding: "14px 12px", gap: "10px" }}>
              <div className="stat-icon blue" style={{ flexShrink: 0 }}>
                <Icon name="user" />
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: "11.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>O‘qituvchilar</span>
                <strong style={{ fontSize: "17px", whiteSpace: "nowrap" }}>{teachers.length} nafar{isLive ? " (demo)" : " (faol)"}</strong>
              </div>
            </div>
            <div className="card overview-stat" style={{ padding: "14px 12px", gap: "10px" }}>
              <div className="stat-icon emerald" style={{ flexShrink: 0 }}>
                <Icon name="users" />
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: "11.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Akademik guruhlar</span>
                <strong style={{ fontSize: "17px", whiteSpace: "nowrap" }}>{groupsLive ? liveGroups!.length : groups.length} ta guruh</strong>
              </div>
            </div>
          </div>

          {groupsLive ? (
            renderLiveGroupsPanel()
          ) : (
          <>
          {/* Academic Groups & Curators Status Overview (demo / local data) */}
          <div className="card" style={{ padding: "22px", marginBottom: "26px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <p className="card-kicker">GURUHLAR VA BIRIKTIRUVLAR HOLATI</p>
                <h3 style={{ margin: "4px 0 0", fontSize: "17px", color: "var(--navy)" }}>
                  Akademik Guruhlar va Mas’ul O‘qituvchilar Holati
                </h3>
              </div>
              <button
                onClick={() => setActiveTab("groups")}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "var(--royal)",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Barcha guruhlarni boshqarish ({groups.length}) →
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px" }}>
              {groups.map((g) => (
                <div
                  key={g.id}
                  style={{
                    padding: "14px",
                    borderRadius: "10px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <strong style={{ fontSize: "15px", color: "var(--navy)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <Icon name="users" size={15} /> {g.code}
                    </strong>
                    <span className="level-badge">{g.course}</span>
                  </div>
                  <div style={{ fontSize: "12.5px", color: "var(--muted)", marginBottom: "4px" }}>
                    Yo‘nalish: <strong style={{ color: "var(--navy)" }}>{g.directionName}</strong>
                  </div>
                  <div style={{ fontSize: "12.5px", color: "var(--text-3)", marginBottom: "8px" }}>
                    Kurator:{" "}
                    <strong style={{ color: g.curatorId && g.curatorName && g.curatorName !== "Biriktirilmagan" ? "var(--royal)" : "var(--warning-fg)" }}>
                      {g.curatorName && g.curatorName !== "Biriktirilmagan" ? g.curatorName : "Biriktirilmagan"}
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                    <span>Talabalar: <strong>{g.studentsCount} nafar</strong></span>
                    <span>O‘rtacha: <strong style={{ color: "var(--success-400)" }}>{g.avgScore ? `${g.avgScore} ball` : "Yangi"}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </>
          )}

          {/* Directions comparison & Level distribution */}
          {renderDirectionsAndLevels()}

          {renderGapsSection()}
        </div>
      )}

      {/* TAB 6: CURRICULUM WHITE SPOTS (O‘QUV DASTURI OQ DOG‘LARI) */}
      {activeTab === "curriculum" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--navy)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <Icon name="alertTriangle" size={19} style={{ color: "var(--warning)" }} /> O‘quv Dasturi "Oq Dog‘lari" va AI Tavsiyalari
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "13.5px", color: "var(--muted)" }}>
                Talabalarning 5 qatlamli amaliy dalillari tahlili asosida o‘quv rejaga kiritilishi zarur bo‘lgan amaliy modullar.
              </p>
            </div>
            <button
              className="primary-button"
              onClick={handleDownload}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Icon name="download" size={16} /> Tavsiyalar hisobotini olish (PDF)
            </button>
          </div>

          {renderGapGrid("full")}
        </div>
      )}

      {/* TAB 7: COMPETENCY LEVEL HIERARCHY (MALAKA TAQSIMOTI L1-L5) */}
      {activeTab === "levels" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--navy)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <Icon name="trophy" size={19} style={{ color: "var(--accent)" }} /> Malaka Taqsimoti (L1–L5) va Yo‘nalishlar Bozorga Tayyorligi
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "13.5px", color: "var(--muted)" }}>
                Talabalarning amaliy ko‘nikma darajalari va fakultetlar kesimida bozorga tayyorlik ko‘rsatkichlari.
              </p>
            </div>
          </div>

          {renderDirectionsAndLevels()}
        </div>
      )}

      {/* MODAL 1: ADD TEACHER */}
      {showAddTeacher && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-teacher-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(9, 9, 11, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={() => setShowAddTeacher(false)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "480px",
              padding: "26px",
              borderRadius: "14px",
              background: "white",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 id="add-teacher-title" style={{ margin: 0, fontSize: "18px", color: "var(--navy)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Icon name="teacher" size={18} /> Yangi O‘qituvchi Kiritish
              </h3>
              <button
                onClick={() => setShowAddTeacher(false)}
                aria-label="Yopish"
                style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--subtle)" }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTeacher} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                  O‘qituvchi Ism-familiyasi:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Prof. Dilshodbek Alimov"
                  value={newTeacherName}
                  onChange={(e) => setNewTeacherName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13.5px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                  Ishchi Email manzili:
                </label>
                <input
                  type="email"
                  required
                  placeholder="dilshod.alimov@bstu.uz"
                  value={newTeacherEmail}
                  onChange={(e) => setNewTeacherEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13.5px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                    Ta’lim Yo‘nalishi:
                  </label>
                  <select
                    value={newTeacherDirection}
                    onChange={(e) => setNewTeacherDirection(e.target.value as DirectionCode)}
                    style={{
                      width: "100%",
                      padding: "9px 10px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      fontSize: "13px",
                      background: "white",
                    }}
                  >
                    <option value="software">Dasturiy injiniring</option>
                    <option value="computer">Kompyuter injiniringi</option>
                    <option value="ai">Sun’iy intellekt</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                    Ilmiy unvoni / Lavozimi:
                  </label>
                  <select
                    value={newTeacherTitle}
                    onChange={(e) => setNewTeacherTitle(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 10px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      fontSize: "13px",
                      background: "white",
                    }}
                  >
                    <option value="Professor, DSc">Professor (DSc)</option>
                    <option value="Dotsent, PhD">Dotsent (PhD)</option>
                    <option value="Katta o‘qituvchi">Katta o‘qituvchi</option>
                    <option value="Assistent o‘qituvchi">Assistent o‘qituvchi</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                  Aloqa telefoni:
                </label>
                <input
                  type="text"
                  placeholder="+998 90 123 45 67"
                  value={newTeacherPhone}
                  onChange={(e) => setNewTeacherPhone(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13.5px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowAddTeacher(false)}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  style={{ padding: "8px 18px", borderRadius: "8px" }}
                >
                  O‘qituvchini Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD GROUP & ASSIGN TEACHER */}
      {showAddGroup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-group-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(9, 9, 11, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={handleCloseAddGroup}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "500px",
              padding: "26px",
              borderRadius: "14px",
              background: "white",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 id="add-group-title" style={{ margin: 0, fontSize: "18px", color: "var(--navy)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Icon name="users" size={18} /> Yangi Akademik Guruh Ochish
                </h3>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>Guruh yaratish (o‘qituvchi biriktirish ixtiyoriy)</span>
              </div>
              <button
                onClick={handleCloseAddGroup}
                aria-label="Yopish"
                style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--subtle)" }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                    Guruh Kodi / Nomi:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Masalan: 942-22 DI"
                    value={newGroupCode}
                    onChange={(e) => setNewGroupCode(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      fontSize: "13.5px",
                      boxSizing: "border-box",
                      fontWeight: 700,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                    O‘quv Kursi:
                  </label>
                  <select
                    value={newGroupCourse}
                    onChange={(e) => setNewGroupCourse(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 10px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      fontSize: "13px",
                      background: "white",
                    }}
                  >
                    <option value="1-kurs">1-kurs</option>
                    <option value="2-kurs">2-kurs</option>
                    <option value="3-kurs">3-kurs</option>
                    <option value="4-kurs">4-kurs</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                  Ta’lim Yo‘nalishi:
                </label>
                <select
                  value={newGroupDirection}
                  onChange={(e) => setNewGroupDirection(e.target.value as DirectionCode)}
                  style={{
                    width: "100%",
                    padding: "9px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                    background: "white",
                  }}
                >
                  <option value="software">Dasturiy injiniring</option>
                  <option value="computer">Kompyuter injiniringi</option>
                  <option value="ai">Sun’iy intellekt</option>
                </select>
              </div>

              {/* Step 3: Curator Teacher Assignment (Optional) */}
              <div
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  background: "rgba(30, 58, 138, 0.06)",
                  border: "1px solid rgba(30, 58, 138, 0.2)",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", fontWeight: 800, color: "var(--royal)", marginBottom: "6px" }}>
                  <Icon name="target" size={14} /> Mas’ul O‘qituvchini (Kuratorni) Biriktirish (Ixtiyoriy):
                </label>
                <select
                  value={newGroupCuratorId}
                  onChange={(e) => setNewGroupCuratorId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13.5px",
                    background: "white",
                    fontWeight: 600,
                  }}
                >
                  <option value="">Hozircha biriktirilmasin (O‘qituvchisiz / Keyinroq biriktirish)</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.title} · {t.directionName})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: "11.5px", color: "var(--muted)", display: "block", marginTop: "4px" }}>
                  {newGroupCuratorId
                    ? "Tanlangan o‘qituvchi o‘z panelida ushbu guruh talabalarini va ularning topshiriqlarini qabul qiladi."
                    : "Guruhni dastlab o‘qituvchisiz ochib, keyinchalik xohlagan vaqtda kurator biriktirishingiz mumkin."}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleCloseAddGroup}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  style={{ padding: "8px 18px", borderRadius: "8px" }}
                >
                  Guruhni Yaratish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RE-ASSIGN CURATOR TEACHER TO EXISTING GROUP */}
      {assigningGroup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-curator-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(9, 9, 11, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={() => setAssigningGroup(null)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "460px",
              padding: "24px",
              borderRadius: "14px",
              background: "white",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 id="assign-curator-title" style={{ margin: 0, fontSize: "17.5px", color: "var(--navy)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Icon name="link" size={17} /> Guruh Kuratorini Biriktirish / O‘zgartirish
              </h3>
              <button
                onClick={() => setAssigningGroup(null)}
                aria-label="Yopish"
                style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--subtle)" }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <p style={{ margin: "0 0 16px", fontSize: "13.5px", color: "var(--text-3)" }}>
              <strong>"{assigningGroup.code}"</strong> ({assigningGroup.directionName}) guruhi uchun mas’ul o‘qituvchini tanlang:
            </p>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "6px" }}>
                Mas’ul O‘qituvchi:
              </label>
              <select
                value={selectedCuratorForGroup}
                onChange={(e) => setSelectedCuratorForGroup(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  fontSize: "13.5px",
                  background: "white",
                  fontWeight: 600,
                }}
              >
                <option value="">O‘qituvchisiz (Biriktirilmasin)</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.title} · {t.directionName})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setAssigningGroup(null)}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleSaveGroupAssignment}
                style={{ padding: "8px 18px", borderRadius: "8px" }}
              >
                Biriktirishni Saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: ADD STUDENT & ENROLL TO GROUP */}
      {showAddStudent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-student-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(9, 9, 11, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={() => setShowAddStudent(false)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "480px",
              padding: "26px",
              borderRadius: "14px",
              background: "white",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 id="add-student-title" style={{ margin: 0, fontSize: "18px", color: "var(--navy)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Icon name="student" size={18} /> Yangi Talaba Kiritish
                </h3>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>Talabani guruhga biriktirish va Skill DNA ochish</span>
              </div>
              <button
                onClick={() => setShowAddStudent(false)}
                aria-label="Yopish"
                style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--subtle)" }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                  Talaba Ism-familiyasi:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Jamshid Yo‘ldoshev"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13.5px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                  Email manzili (Login):
                </label>
                <input
                  type="email"
                  required
                  placeholder="jamshid.yuldashev@edu.uz"
                  value={newStudentEmail}
                  onChange={(e) => setNewStudentEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13.5px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                  Akademik Guruh (Ixtiyoriy):
                </label>
                <select
                  value={newStudentGroupCode}
                  onChange={(e) => setNewStudentGroupCode(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13.5px",
                    background: "white",
                    fontWeight: 600,
                  }}
                >
                  <option value="none">Hozircha biriktirilmasin (Guruhsiz / Keyinroq kiritish)</option>
                  {groups.map((g) => (
                    <option key={g.code} value={g.code}>
                      {g.code} ({g.course} · {g.directionName} · Kurator: {g.curatorName})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: "11.5px", color: "var(--muted)", display: "block", marginTop: "4px" }}>
                  {newStudentGroupCode === "none"
                    ? "Talabani dastlab guruhsiz ro‘yxatga olib, keyinchalik istalgan guruhga biriktirish mumkin."
                    : "Talaba tanlangan guruh orqali avtomatik ravishda o‘qituvchiga va yo‘nalish o‘quv dasturiga bog‘lanadi."}
                </span>
              </div>

              {/* If no group chosen, allow specifying Direction and Course */}
              {newStudentGroupCode === "none" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                      Ta’lim yo‘nalishi:
                    </label>
                    <select
                      value={newStudentDirection}
                      onChange={(e) => setNewStudentDirection(e.target.value as DirectionCode)}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        fontSize: "13px",
                        background: "white",
                        fontWeight: 600,
                      }}
                    >
                      <option value="software">Dasturiy injiniring</option>
                      <option value="ai">Sun’iy intellekt</option>
                      <option value="computer">Kompyuter injiniringi</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                      Kursi:
                    </label>
                    <select
                      value={newStudentCourse}
                      onChange={(e) => setNewStudentCourse(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        fontSize: "13px",
                        background: "white",
                        fontWeight: 600,
                      }}
                    >
                      <option value="1-kurs">1-kurs</option>
                      <option value="2-kurs">2-kurs</option>
                      <option value="3-kurs">3-kurs</option>
                      <option value="4-kurs">4-kurs</option>
                    </select>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowAddStudent(false)}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  style={{ padding: "8px 18px", borderRadius: "8px" }}
                >
                  Talabani Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: ASSIGN STUDENT TO GROUP */}
      {assigningStudent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-student-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(9, 9, 11, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={() => setAssigningStudent(null)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "460px",
              padding: "24px",
              borderRadius: "14px",
              background: "white",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 id="assign-student-title" style={{ margin: 0, fontSize: "18px", color: "var(--navy)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Icon name="users" size={18} /> Guruhga Biriktirish
                </h3>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {assigningStudent.name} ({assigningStudent.email})
                </span>
              </div>
              <button
                onClick={() => setAssigningStudent(null)}
                aria-label="Yopish"
                style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--subtle)" }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "6px" }}>
                Biriktiriladigan Akademik Guruh:
              </label>
              <select
                value={selectedGroupForStudent}
                onChange={(e) => setSelectedGroupForStudent(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  fontSize: "13.5px",
                  background: "white",
                  fontWeight: 600,
                }}
              >
                {groups.map((g) => (
                  <option key={g.code} value={g.code}>
                    {g.code} ({g.course} · {g.directionName} · Kurator: {g.curatorName})
                  </option>
                ))}
              </select>
              <span style={{ fontSize: "11.5px", color: "var(--muted)", display: "block", marginTop: "5px" }}>
                Guruh tanlangach, talaba avtomatik tarzda guruh kuratoriga va o‘quv dasturiga biriktiriladi.
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setAssigningStudent(null)}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleAssignStudentToGroup}
                style={{ padding: "8px 18px", borderRadius: "8px" }}
              >
                Biriktirishni Saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: EDIT TEACHER */}
      {editingTeacher && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-teacher-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(9, 9, 11, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={() => setEditingTeacher(null)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "500px",
              padding: "26px",
              borderRadius: "14px",
              background: "white",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 id="edit-teacher-title" style={{ margin: 0, fontSize: "18px", color: "var(--navy)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Icon name="edit" size={18} /> O‘qituvchini Tahrirlash
                </h3>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  O‘qituvchi ma’lumotlari va lavozimini yangilash
                </span>
              </div>
              <button
                onClick={() => setEditingTeacher(null)}
                aria-label="Yopish"
                style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--subtle)" }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateTeacher} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                  Ism-sharifi:
                </label>
                <input
                  type="text"
                  required
                  value={editTeacherName}
                  onChange={(e) => setEditTeacherName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13.5px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                    Ilmiy unvoni / Lavozimi:
                  </label>
                  <input
                    type="text"
                    required
                    value={editTeacherTitle}
                    onChange={(e) => setEditTeacherTitle(e.target.value)}
                    placeholder="Masalan: Dotsent, PhD"
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                    Mutaxassislik yo‘nalishi:
                  </label>
                  <select
                    value={editTeacherDirection}
                    onChange={(e) => setEditTeacherDirection(e.target.value as DirectionCode)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      fontSize: "13px",
                      background: "white",
                      fontWeight: 600,
                    }}
                  >
                    <option value="software">Dasturiy injiniring</option>
                    <option value="ai">Sun’iy intellekt</option>
                    <option value="computer">Kompyuter injiniringi</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                  Kafedrasi:
                </label>
                <input
                  type="text"
                  required
                  value={editTeacherDepartment}
                  onChange={(e) => setEditTeacherDepartment(e.target.value)}
                  placeholder="Masalan: Dasturiy ta’minot kafedrasi"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                    Email (Login):
                  </label>
                  <input
                    type="email"
                    required
                    value={editTeacherEmail}
                    onChange={(e) => setEditTeacherEmail(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                    Telefon raqami:
                  </label>
                  <input
                    type="text"
                    required
                    value={editTeacherPhone}
                    onChange={(e) => setEditTeacherPhone(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setEditingTeacher(null)}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  style={{ padding: "8px 18px", borderRadius: "8px" }}
                >
                  O‘zgarishlarni Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: DELETE TEACHER CONFIRM */}
      {deletingTeacher && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-teacher-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(9, 9, 11, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={() => setDeletingTeacher(null)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "460px",
              padding: "24px",
              borderRadius: "14px",
              background: "white",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  background: "var(--danger-soft)",
                  color: "var(--danger)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name="alertTriangle" size={22} />
              </div>
              <div>
                <h3 id="delete-teacher-title" style={{ margin: 0, fontSize: "17.5px", color: "var(--navy)" }}>
                  O‘qituvchini O‘chirish
                </h3>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Bu amalni ortga qaytarib bo‘lmaydi
                </span>
              </div>
            </div>

            <div
              style={{
                padding: "14px",
                background: "var(--surface-2)",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                fontSize: "13.5px",
                marginBottom: "16px",
              }}
            >
              <p style={{ margin: "0 0 8px", color: "var(--navy)" }}>
                Haqiqatan ham quyidagi o‘qituvchini o‘chirmoqchimisiz?
              </p>
              <div style={{ fontWeight: 700, color: "var(--navy)", fontSize: "15px" }}>
                {deletingTeacher.name}
              </div>
              <div style={{ fontSize: "12.5px", color: "var(--muted)", marginTop: "2px" }}>
                {deletingTeacher.title} · {deletingTeacher.department}
              </div>
              {deletingTeacher.assignedGroups.length > 0 && (
                <div style={{ marginTop: "10px", padding: "8px 10px", background: "var(--danger-soft)", borderRadius: "6px", border: "1px solid var(--danger-ring)", fontSize: "12px", color: "var(--danger-fg)" }}>
                  Mazkur o‘qituvchiga <strong>{deletingTeacher.assignedGroups.join(", ")}</strong> guruhlari biriktirilgan. O‘chirilgandan so‘ng bu guruhlar kuratori <em>"Biriktirilmagan"</em> holatiga o‘tadi (guruhlar va talabalar saqlanadi).
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDeletingTeacher(null)}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleDeleteTeacher}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: 0,
                  background: "var(--danger)",
                  color: "white",
                  fontWeight: 700,
                  fontSize: "13.5px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Icon name="trash" size={14} /> Ha, O‘chirish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: EDIT GROUP */}
      {editingGroup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-group-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(9, 9, 11, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={() => setEditingGroup(null)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "480px",
              padding: "26px",
              borderRadius: "14px",
              background: "white",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 id="edit-group-title" style={{ margin: 0, fontSize: "18px", color: "var(--navy)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Icon name="edit" size={18} /> Akademik Guruhni Tahrirlash
                </h3>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Guruh kodi, kursi, yo‘nalishi va mas’ul o‘qituvchisini yangilash
                </span>
              </div>
              <button
                onClick={() => setEditingGroup(null)}
                aria-label="Yopish"
                style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--subtle)" }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateGroup} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                    Guruh kodi / Raqami:
                  </label>
                  <input
                    type="text"
                    required
                    value={editGroupCode}
                    onChange={(e) => setEditGroupCode(e.target.value)}
                    placeholder="Masalan: 941-21 DI"
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      fontSize: "13.5px",
                      boxSizing: "border-box",
                      fontWeight: 700,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                    Bosqich (Kurs):
                  </label>
                  <select
                    value={editGroupCourse}
                    onChange={(e) => setEditGroupCourse(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      fontSize: "13px",
                      background: "white",
                      fontWeight: 600,
                    }}
                  >
                    <option value="1-kurs">1-kurs</option>
                    <option value="2-kurs">2-kurs</option>
                    <option value="3-kurs">3-kurs</option>
                    <option value="4-kurs">4-kurs</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                  Ta’lim yo‘nalishi:
                </label>
                <select
                  value={editGroupDirection}
                  onChange={(e) => setEditGroupDirection(e.target.value as DirectionCode)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                    background: "white",
                    fontWeight: 600,
                  }}
                >
                  <option value="software">Dasturiy injiniring</option>
                  <option value="ai">Sun’iy intellekt</option>
                  <option value="computer">Kompyuter injiniringi</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                  Mas’ul o‘qituvchi (Kurator):
                </label>
                <select
                  value={editGroupCuratorId}
                  onChange={(e) => setEditGroupCuratorId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13px",
                    background: "white",
                    fontWeight: 600,
                  }}
                >
                  <option value="none">Biriktirilmasin (O‘qituvchisiz)</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.title} · {t.department})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: "11.5px", color: "var(--muted)", display: "block", marginTop: "4px" }}>
                  Guruh kodi o‘zgartirilsa, unga tegishli barcha talabalar kodi avtomatik yangilanadi.
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setEditingGroup(null)}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  style={{ padding: "8px 18px", borderRadius: "8px" }}
                >
                  O‘zgarishlarni Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 9: DELETE GROUP CONFIRM */}
      {deletingGroup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-group-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(9, 9, 11, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={() => setDeletingGroup(null)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "460px",
              padding: "24px",
              borderRadius: "14px",
              background: "white",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  background: "var(--danger-soft)",
                  color: "var(--danger)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name="alertTriangle" size={22} />
              </div>
              <div>
                <h3 id="delete-group-title" style={{ margin: 0, fontSize: "17.5px", color: "var(--navy)" }}>
                  Akademik Guruhni O‘chirish
                </h3>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Guruhni akademik tizimdan olib tashlash
                </span>
              </div>
            </div>

            <div
              style={{
                padding: "14px",
                background: "var(--surface-2)",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                fontSize: "13.5px",
                marginBottom: "16px",
              }}
            >
              <p style={{ margin: "0 0 8px", color: "var(--navy)" }}>
                Haqiqatan ham ushbu guruhni o‘chirmoqchimisiz?
              </p>
              <div style={{ fontWeight: 700, color: "var(--navy)", fontSize: "16px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Icon name="users" size={16} /> {deletingGroup.code}
              </div>
              <div style={{ fontSize: "12.5px", color: "var(--muted)", marginTop: "2px" }}>
                {deletingGroup.directionName} · {deletingGroup.course} · {deletingGroup.studentsCount} nafar talaba
              </div>
              <div style={{ marginTop: "10px", padding: "8px 10px", background: "var(--danger-soft)", borderRadius: "6px", border: "1px solid var(--danger-ring)", fontSize: "12px", color: "var(--danger-fg)" }}>
                Mazkur guruhdagi talabalar o‘chirilmaydi, ammo <em>"Guruhsiz"</em> maqomiga o‘tkaziladi va keyinroq yangi guruhga biriktirilishi mumkin.
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDeletingGroup(null)}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleDeleteGroup}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: 0,
                  background: "var(--danger)",
                  color: "white",
                  fontWeight: 700,
                  fontSize: "13.5px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Icon name="trash" size={14} /> Ha, O‘chirish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 10: EDIT STUDENT */}
      {editingStudent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-student-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(9, 9, 11, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={() => setEditingStudent(null)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "500px",
              padding: "26px",
              borderRadius: "14px",
              background: "white",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 id="edit-student-title" style={{ margin: 0, fontSize: "18px", color: "var(--navy)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Icon name="edit" size={18} /> Talaba Ma’lumotlarini Tahrirlash
                </h3>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Guruh, malaka darajasi va ko‘rsatkichlarini yangilash
                </span>
              </div>
              <button
                onClick={() => setEditingStudent(null)}
                aria-label="Yopish"
                style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--subtle)" }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateStudent} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                  Talaba Ism-familiyasi:
                </label>
                <input
                  type="text"
                  required
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13.5px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                  Email manzili (Login):
                </label>
                <input
                  type="email"
                  required
                  value={editStudentEmail}
                  onChange={(e) => setEditStudentEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13.5px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                  Akademik Guruh:
                </label>
                <select
                  value={editStudentGroupCode}
                  onChange={(e) => setEditStudentGroupCode(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    fontSize: "13.5px",
                    background: "white",
                    fontWeight: 600,
                  }}
                >
                  <option value="none">Guruhsiz / Hozircha biriktirilmasin</option>
                  {groups.map((g) => (
                    <option key={g.code} value={g.code}>
                      {g.code} ({g.course} · {g.directionName} · Kurator: {g.curatorName})
                    </option>
                  ))}
                </select>
              </div>

              {(!editStudentGroupCode || editStudentGroupCode === "none") && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                      Ta’lim yo‘nalishi:
                    </label>
                    <select
                      value={editStudentDirection}
                      onChange={(e) => setEditStudentDirection(e.target.value as DirectionCode)}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        fontSize: "13px",
                        background: "white",
                        fontWeight: 600,
                      }}
                    >
                      <option value="software">Dasturiy injiniring</option>
                      <option value="ai">Sun’iy intellekt</option>
                      <option value="computer">Kompyuter injiniringi</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                      Kursi:
                    </label>
                    <select
                      value={editStudentCourse}
                      onChange={(e) => setEditStudentCourse(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        fontSize: "13px",
                        background: "white",
                        fontWeight: 600,
                      }}
                    >
                      <option value="1-kurs">1-kurs</option>
                      <option value="2-kurs">2-kurs</option>
                      <option value="3-kurs">3-kurs</option>
                      <option value="4-kurs">4-kurs</option>
                    </select>
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                    Amaliy malaka darajasi:
                  </label>
                  <select
                    value={editStudentLevel}
                    onChange={(e) => setEditStudentLevel(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      fontSize: "13px",
                      background: "white",
                      fontWeight: 600,
                    }}
                  >
                    <option value="L1">L1 - Boshlang‘ich</option>
                    <option value="L2">L2 - Junior</option>
                    <option value="L3">L3 - Amaliyotchi</option>
                    <option value="L4">L4 - Strong Junior</option>
                    <option value="L5">L5 - Mustaqil muhandis</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "var(--text-3)", marginBottom: "5px" }}>
                    Ko‘nikma bali (0-100):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={editStudentScore}
                    onChange={(e) => setEditStudentScore(Number(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      fontSize: "13px",
                      boxSizing: "border-box",
                      fontWeight: 700,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setEditingStudent(null)}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  style={{ padding: "8px 18px", borderRadius: "8px" }}
                >
                  O‘zgarishlarni Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 11: DELETE STUDENT CONFIRM */}
      {deletingStudent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-student-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(9, 9, 11, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={() => setDeletingStudent(null)}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "460px",
              padding: "24px",
              borderRadius: "14px",
              background: "white",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  background: "var(--danger-soft)",
                  color: "var(--danger)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name="alertTriangle" size={22} />
              </div>
              <div>
                <h3 id="delete-student-title" style={{ margin: 0, fontSize: "17.5px", color: "var(--navy)" }}>
                  Talabani Ro‘yxatdan O‘chirish
                </h3>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Talaba profilini butunlay o‘chirish
                </span>
              </div>
            </div>

            <div
              style={{
                padding: "14px",
                background: "var(--surface-2)",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                fontSize: "13.5px",
                marginBottom: "16px",
              }}
            >
              <p style={{ margin: "0 0 8px", color: "var(--navy)" }}>
                Haqiqatan ham quyidagi talabani o‘chirmoqchimisiz?
              </p>
              <div style={{ fontWeight: 700, color: "var(--navy)", fontSize: "15px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Icon name="student" size={16} /> {deletingStudent.name}
              </div>
              <div style={{ fontSize: "12.5px", color: "var(--muted)", marginTop: "2px" }}>
                {deletingStudent.email} · Guruhi: {deletingStudent.groupCode || "Guruhsiz"} ({deletingStudent.level}, {deletingStudent.score} ball)
              </div>
              <div style={{ marginTop: "10px", padding: "8px 10px", background: "var(--danger-soft)", borderRadius: "6px", border: "1px solid var(--danger-ring)", fontSize: "12px", color: "var(--danger-fg)" }}>
                Talabaning barcha diagnostika natijalari va Skill DNA ko‘rsatkichlari bazadan olib tashlanadi hamda tegishli guruh talabalar soni 1 taga kamayadi.
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDeletingStudent(null)}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleDeleteStudent}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: 0,
                  background: "var(--danger)",
                  color: "white",
                  fontWeight: 700,
                  fontSize: "13.5px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Icon name="trash" size={14} /> Ha, O‘chirish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            background: "var(--ink)",
            color: "var(--surface-2)",
            padding: "12px 18px",
            borderRadius: "10px",
            border: "1px solid var(--success-400)",
            boxShadow: "0 12px 30px rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13.5px",
            fontWeight: 600,
            maxWidth: "460px",
          }}
        >
          <span style={{ display: "inline-flex", color: "var(--success-400)", flexShrink: 0 }}>
            <Icon name="checkCircle" size={20} />
          </span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
