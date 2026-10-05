export type DirectionCode = "software" | "computer" | "ai";

export type Role = "student" | "teacher" | "employer" | "university" | "moderator" | "super_admin";

export type LayerKey = "KNOW" | "DO" | "ADAPT" | "DEFEND" | "PROVE";

export type Level = "L1" | "L2" | "L3" | "L4" | "L5";

export interface LayerItem {
  key: LayerKey;
  label: string;
  score: number;
  weight: string;
  weightNum: number;
  tone: "blue" | "emerald" | "violet" | "amber" | "rose";
  icon: string;
}

export interface SkillItem {
  id: string;
  code: string;
  name: string;
  isCore: boolean; // Pilotdagi asosiy (Core) skill
  direction: DirectionCode;
  score: number;
  confidence: number;
  level: Level;
  layers: Record<LayerKey, number>;
  evidenceCount: number;
  verifiedCount: number;
}

export interface DirectionItem {
  code: DirectionCode;
  title: string;
  categoryBadge: string;
  targetRole: string;
  skills: SkillItem[];
  careerTarget: {
    roleName: string;
    matchPct: number;
    gaps: { skill: string; current: number; needed: number }[];
  };
}

export interface EvidenceItem {
  id: string;
  title: string;
  type: string;
  layer: LayerKey;
  score: number;
  time: string;
  status: "Tasdiqlangan" | "Ko‘rib chiqildi" | "Kutilmoqda" | "Rad etildi";
  studentName?: string;
  direction?: DirectionCode;
}

export interface IntegrityFlag {
  id: string;
  type: "CROSS_LAYER_GAP" | "VIVA_DISAGREEMENT" | "SIMILARITY_HIGH" | "PASTE_BURST" | "LATENCY_ANOMALY" | "PROXY_SUBMISSION";
  studentName: string;
  studentGroup?: string;
  skillName: string;
  severity: "high" | "medium" | "low";
  reason: string;
  status: "open" | "resolved" | "appealed";
  timestamp: string;
  metrics?: {
    doScore?: number;
    defendScore?: number;
    discrepancy?: number;
    model1Score?: number;
    model2Score?: number;
    similarityPct?: number;
    pasteLines?: number;
    latencySeconds?: number;
  };
  transcriptExcerpt?: {
    question: string;
    answer: string;
    aiVerdict: string;
    confidence: number;
  };
}

export interface VivaTranscriptItem {
  id: string;
  studentName: string;
  studentGroup: string;
  direction: DirectionCode;
  taskTitle: string;
  date: string;
  overallScore: number;
  integrityScore: number;
  status: "verified" | "flagged" | "review_needed";
  duration: string;
  audioDurationSec: number;
  qaPairs: {
    question: string;
    answer: string;
    evaluatorScore: number;
    audioConfidence: number;
    flagRaised?: boolean;
  }[];
}

export interface IntegrityRuleItem {
  id: string;
  code: string;
  name: string;
  description: string;
  category: "cross_layer" | "inter_rater" | "similarity" | "keystroke" | "latency";
  threshold: number;
  unit: string;
  severity: "high" | "medium" | "low";
  isActive: boolean;
  triggeredCount: number;
  explanation: string;
}

export interface EmployerCandidate {
  id: string;
  name: string;
  direction: DirectionCode;
  directionName: string;
  overallScore: number;
  confidence: number;
  level: Level;
  matchScore: number;
  matchReason: string;
  topSkills: { name: string; score: number }[];
  verifiedBadges: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  direction?: DirectionCode;
  organization?: string;
  avatar: string;
  /** Profile photo as a data URL (null/undefined = show initials) */
  photo?: string | null;
  course?: number;
  group?: string;
  bio?: string;
}
