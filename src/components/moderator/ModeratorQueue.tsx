import { useState, useEffect } from "react";
import { Icon } from "../common/Icons";
import {
  initialModeratorFlags,
  sampleVivaTranscripts,
  initialIntegrityRules,
} from "../../data/ontology";
import type {
  IntegrityFlag,
  VivaTranscriptItem,
  IntegrityRuleItem,
} from "../../types";

interface ModeratorQueueProps {
  activeTab?: "flags" | "transcripts" | "rules";
  onTabChange?: (tab: "flags" | "transcripts" | "rules") => void;
}

export default function ModeratorQueue({
  activeTab = "flags",
  onTabChange,
}: ModeratorQueueProps) {
  // Local or controlled tab
  const [currentTab, setCurrentTab] = useState<"flags" | "transcripts" | "rules">(activeTab);

  useEffect(() => {
    setCurrentTab(activeTab);
  }, [activeTab]);

  const setTab = (tab: "flags" | "transcripts" | "rules") => {
    setCurrentTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  // State for Flags
  const [flags, setFlags] = useState<IntegrityFlag[]>(initialModeratorFlags);
  const [activeFlag, setActiveFlag] = useState<IntegrityFlag | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");

  // State for Viva Transcripts
  const [transcripts, setTranscripts] = useState<VivaTranscriptItem[]>(sampleVivaTranscripts);
  const [transcriptSearch, setTranscriptSearch] = useState<string>("");
  const [transcriptFilter, setTranscriptFilter] = useState<string>("all");
  const [expandedTranscriptId, setExpandedTranscriptId] = useState<string | null>("vt-1");
  const [playingTranscriptId, setPlayingTranscriptId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<number>(35);

  // State for Integrity Rules
  const [rules, setRules] = useState<IntegrityRuleItem[]>(initialIntegrityRules);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Resolve Flag Action
  const handleResolve = (flagId: string, actionText: string) => {
    setFlags((prev) =>
      prev.map((f) => (f.id === flagId ? { ...f, status: "resolved" } : f))
    );
    setActiveFlag(null);
    setReviewNotes("");
    showToast(`Qaror ijro etildi: ${actionText}`);
  };

  // Toggle Rule
  const handleToggleRule = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) =>
        r.id === ruleId
          ? {
              ...r,
              isActive: !r.isActive,
            }
          : r
      )
    );
    const rule = rules.find((r) => r.id === ruleId);
    showToast(
      `"${rule?.name}" qoidasi ${!rule?.isActive ? "faollashtirildi" : "to‘xtatildi"}`
    );
  };

  // Change Threshold Slider
  const handleThresholdChange = (ruleId: string, val: number) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, threshold: val } : r))
    );
  };

  // Play / Pause Audio Simulation
  const handleTogglePlay = (id: string) => {
    if (playingTranscriptId === id) {
      setPlayingTranscriptId(null);
    } else {
      setPlayingTranscriptId(id);
      setAudioProgress(15);
    }
  };

  // Transcripts action
  const handleTranscriptVerdict = (id: string, newStatus: "verified" | "flagged", label: string) => {
    setTranscripts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
    );
    showToast(`Transkript holati yangilandi: ${label}`);
  };

  // Filtered Flags
  const filteredFlags = flags.filter((f) => {
    const matchesSearch =
      searchQuery.trim() === "" ||
      f.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.skillName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.reason.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity =
      selectedSeverity === "all" || f.severity === selectedSeverity;

    const matchesStatus =
      selectedStatus === "all" || f.status === selectedStatus;

    const matchesType =
      selectedType === "all" || f.type === selectedType;

    return matchesSearch && matchesSeverity && matchesStatus && matchesType;
  });

  // Filtered Transcripts
  const filteredTranscripts = transcripts.filter((t) => {
    const matchesSearch =
      transcriptSearch.trim() === "" ||
      t.studentName.toLowerCase().includes(transcriptSearch.toLowerCase()) ||
      t.taskTitle.toLowerCase().includes(transcriptSearch.toLowerCase());

    const matchesStatus =
      transcriptFilter === "all" || t.status === transcriptFilter;

    return matchesSearch && matchesStatus;
  });

  const openCount = flags.filter((f) => f.status === "open").length;
  const resolvedCount = flags.filter((f) => f.status === "resolved").length;
  const highRiskCount = flags.filter((f) => f.severity === "high" && f.status === "open").length;

  return (
    <div className="page">
      {/* Top Welcome Row */}
      <section className="welcome-row">
        <div>
          <p className="eyebrow">INTEGRITY & HALOLLIK TIZIMI · MODERATSIYA ISH STOLI</p>
          <h1>Fake Skill va Nomuvofiqliklar nazorati</h1>
          <p className="subtitle">
            AI detektorga emas, 5 qatlamli kross-tahlil va baholovchilar kelishmovchiligiga asoslangan insoniy qarorlar (Human-in-the-loop).
          </p>
        </div>
      </section>

      {/* Internal Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "22px",
          borderBottom: "1.5px solid #e2e8f0",
          paddingBottom: "10px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() => setTab("flags")}
          style={{
            padding: "9px 18px",
            borderRadius: "10px",
            border: currentTab === "flags" ? "1.5px solid var(--navy)" : "1.5px solid #e2e8f0",
            background: currentTab === "flags" ? "var(--navy)" : "#ffffff",
            color: currentTab === "flags" ? "#ffffff" : "var(--navy)",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.15s ease",
            boxShadow: currentTab === "flags" ? "0 4px 12px rgba(15, 39, 68, 0.12)" : "none",
          }}
        >
          <Icon name="shield" size={16} />
          <span>Bayroqlar navbati</span>
          <span
            style={{
              padding: "2px 7px",
              borderRadius: "10px",
              background: currentTab === "flags" ? "rgba(255,255,255,0.2)" : "#fee2e2",
              color: currentTab === "flags" ? "#ffffff" : "#dc2626",
              fontSize: "11px",
              fontWeight: 800,
            }}
          >
            {openCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab("transcripts")}
          style={{
            padding: "9px 18px",
            borderRadius: "10px",
            border: currentTab === "transcripts" ? "1.5px solid var(--navy)" : "1.5px solid #e2e8f0",
            background: currentTab === "transcripts" ? "var(--navy)" : "#ffffff",
            color: currentTab === "transcripts" ? "#ffffff" : "var(--navy)",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.15s ease",
            boxShadow: currentTab === "transcripts" ? "0 4px 12px rgba(15, 39, 68, 0.12)" : "none",
          }}
        >
          <Icon name="file" size={16} />
          <span>Viva Transkript tekshiruvi</span>
          <span
            style={{
              padding: "2px 7px",
              borderRadius: "10px",
              background: currentTab === "transcripts" ? "rgba(255,255,255,0.2)" : "#eff6ff",
              color: currentTab === "transcripts" ? "#ffffff" : "#2563eb",
              fontSize: "11px",
              fontWeight: 800,
            }}
          >
            {transcripts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab("rules")}
          style={{
            padding: "9px 18px",
            borderRadius: "10px",
            border: currentTab === "rules" ? "1.5px solid var(--navy)" : "1.5px solid #e2e8f0",
            background: currentTab === "rules" ? "var(--navy)" : "#ffffff",
            color: currentTab === "rules" ? "#ffffff" : "var(--navy)",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.15s ease",
            boxShadow: currentTab === "rules" ? "0 4px 12px rgba(15, 39, 68, 0.12)" : "none",
          }}
        >
          <Icon name="settings" size={16} />
          <span>Ontologiya & Rubrikalar</span>
          <span
            style={{
              padding: "2px 7px",
              borderRadius: "10px",
              background: currentTab === "rules" ? "rgba(255,255,255,0.2)" : "#f1f5f9",
              color: currentTab === "rules" ? "#ffffff" : "#475569",
              fontSize: "11px",
              fontWeight: 800,
            }}
          >
            {rules.filter((r) => r.isActive).length} faol
          </span>
        </button>
      </div>

      {/* Summary Stats Row */}
      <section className="employer-stats-row">
        <div className="employer-stat-pill">
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "#fee2e2",
              color: "#dc2626",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="alert" size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              Ochiq bayroqlar
            </div>
            <strong style={{ fontSize: "19px", color: "var(--navy)" }}>{openCount} ta holat</strong>
          </div>
        </div>

        <div className="employer-stat-pill">
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "#ecfdf5",
              color: "#059669",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="checkCircle" size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              Hal qilingan
            </div>
            <strong style={{ fontSize: "19px", color: "var(--navy)" }}>{resolvedCount} ta tekshiruv</strong>
          </div>
        </div>

        <div className="employer-stat-pill">
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "#fef3c7",
              color: "#d97706",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="shieldCheck" size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              Yuqori xavfli (High)
            </div>
            <strong style={{ fontSize: "19px", color: "var(--navy)" }}>{highRiskCount} ta zudlik bilan</strong>
          </div>
        </div>

        <div className="employer-stat-pill">
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "#eff6ff",
              color: "#2563eb",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="workflow" size={20} />
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              Avtomatik Rubrikalar
            </div>
            <strong style={{ fontSize: "19px", color: "var(--navy)" }}>5 ta faol filtr</strong>
          </div>
        </div>
      </section>

      {/* TAB 1: BAYROQLAR NAVBATI (FLAGS QUEUE) */}
      {currentTab === "flags" && (
        <>
          {/* Advanced Filter Card */}
          <section className="employer-filter-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <div>
                <p className="card-kicker" style={{ margin: 0 }}>
                  MODERATSIYA SARALASH VA QIDIRUV
                </p>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Shubhali holatlarni xavflilik darajasi va turi bo‘yicha tezkor tahlil qiling
                </span>
              </div>

              {/* Search box */}
              <div style={{ position: "relative", minWidth: "280px" }}>
                <span
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--muted)",
                    pointerEvents: "none",
                  }}
                >
                  <Icon name="search" size={16} />
                </span>
                <input
                  type="text"
                  placeholder="Talaba ismi, ko‘nikma yoki sabab..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px 9px 36px",
                    borderRadius: "10px",
                    border: "1.5px solid var(--border)",
                    fontSize: "13px",
                    outline: "none",
                    background: "#f8fafc",
                    transition: "border-color 0.2s, background 0.2s",
                  }}
                />
              </div>
            </div>

            {/* Severity and Status Filter Chips */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", minWidth: "90px" }}>
                  XAVFLILIK:
                </span>
                {[
                  { key: "all", label: "Barchasi" },
                  { key: "high", label: "🔴 Yuqori xavf (High)" },
                  { key: "medium", label: "🟡 O‘rta xavf (Medium)" },
                  { key: "low", label: "⚪ Past xavf (Low)" },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSelectedSeverity(s.key)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: selectedSeverity === s.key ? "1.5px solid var(--navy)" : "1.5px solid #e2e8f0",
                      background: selectedSeverity === s.key ? "var(--navy)" : "#ffffff",
                      color: selectedSeverity === s.key ? "#ffffff" : "var(--navy)",
                      transition: "0.15s ease",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", minWidth: "90px" }}>
                  HOLAT:
                </span>
                {[
                  { key: "all", label: `Barchasi (${flags.length})` },
                  { key: "open", label: `⏳ Kutilmoqda (${openCount})` },
                  { key: "resolved", label: `✅ Hal qilingan (${resolvedCount})` },
                ].map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => setSelectedStatus(st.key)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: selectedStatus === st.key ? "1.5px solid var(--royal)" : "1.5px solid #e2e8f0",
                      background: selectedStatus === st.key ? "var(--royal)" : "#ffffff",
                      color: selectedStatus === st.key ? "#ffffff" : "var(--navy)",
                      transition: "0.15s ease",
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Flags List Heading */}
          <div
            className="section-heading"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: "18px",
            }}
          >
            <div>
              <h2>Tekshiruv talab qilinadigan holatlar ({filteredFlags.length})</h2>
              <p>5 qatlamli kross-tahlil natijasida aniqlangan anomaliyalar va baholovchilar ixtiloflari</p>
            </div>
            {(searchQuery || selectedSeverity !== "all" || selectedStatus !== "all" || selectedType !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedSeverity("all");
                  setSelectedStatus("all");
                  setSelectedType("all");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--royal)",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <Icon name="refresh" size={14} /> Filtrlarni tiklash
              </button>
            )}
          </div>

          {filteredFlags.length === 0 ? (
            <div className="card" style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>
              <div
                style={{
                  width: "54px",
                  height: "54px",
                  borderRadius: "50%",
                  background: "#f1f5f9",
                  color: "var(--muted)",
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 16px",
                }}
              >
                <Icon name="checkCircle" size={26} />
              </div>
              <h3 style={{ margin: "0 0 6px", color: "var(--navy)", fontSize: "17px" }}>
                Hech qanday shubhali holat topilmadi
              </h3>
              <p style={{ margin: 0, fontSize: "13.5px" }}>
                Filtr mezonlarini o‘zgartiring yoki qidiruv so‘zini tozalang.
              </p>
            </div>
          ) : (
            <div
              className={`candidates-grid ${filteredFlags.length === 1 ? "single-item" : ""}`}
            >
              {filteredFlags.map((flag) => {
                const isHigh = flag.severity === "high";
                const isMed = flag.severity === "medium";
                const isResolved = flag.status === "resolved";

                return (
                  <article
                    key={flag.id}
                    className="candidate-card"
                    style={{
                      opacity: isResolved ? 0.72 : 1,
                      borderLeft: isHigh
                        ? "4px solid #ef4444"
                        : isMed
                        ? "4px solid #f59e0b"
                        : "4px solid #94a3b8",
                    }}
                  >
                    {/* Top Row: Student info & Status */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "14px",
                        gap: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div
                          style={{
                            width: "44px",
                            height: "44px",
                            minWidth: "44px",
                            borderRadius: "12px",
                            background: isHigh
                              ? "linear-gradient(135deg, #7f1d1d, #991b1b)"
                              : isMed
                              ? "linear-gradient(135deg, #78350f, #92400e)"
                              : "linear-gradient(135deg, #1e293b, #334155)",
                            color: "#ffffff",
                            display: "grid",
                            placeItems: "center",
                            fontWeight: 800,
                            fontSize: "15px",
                            boxShadow: "0 2px 8px rgba(15, 23, 42, 0.15)",
                          }}
                        >
                          {flag.studentName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <div>
                          <h3 style={{ margin: 0, fontSize: "16.5px", fontWeight: 700, color: "var(--navy)" }}>
                            {flag.studentName}
                          </h3>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
                            <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 500 }}>
                              {flag.studentGroup || "DI-2023-4A"}
                            </span>
                            <span>•</span>
                            <span
                              style={{
                                padding: "2px 7px",
                                borderRadius: "6px",
                                background: "#eff6ff",
                                color: "var(--royal)",
                                fontSize: "11px",
                                fontWeight: 700,
                              }}
                            >
                              {flag.skillName}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status badge */}
                      <span
                        style={{
                          padding: "5px 11px",
                          borderRadius: "20px",
                          fontSize: "11.5px",
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          background: isResolved ? "#ecfdf5" : isHigh ? "#fee2e2" : "#fef3c7",
                          color: isResolved ? "#059669" : isHigh ? "#b91c1c" : "#b45309",
                          border: isResolved ? "1px solid #a7f3d0" : isHigh ? "1px solid #fecaca" : "1px solid #fde68a",
                        }}
                      >
                        {isResolved ? (
                          <>
                            <Icon name="check" size={13} /> Hal qilingan
                          </>
                        ) : (
                          <>
                            <span className="live-pulse-indicator" style={{ background: isHigh ? "#dc2626" : "#d97706" }} />
                            Kutilmoqda
                          </>
                        )}
                      </span>
                    </div>

                    {/* Flag Type & Timestamp Badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                      <span
                        style={{
                          padding: "3px 9px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: 800,
                          letterSpacing: "0.03em",
                          background: isHigh ? "#fee2e2" : isMed ? "#fef3c7" : "#f1f5f9",
                          color: isHigh ? "#dc2626" : isMed ? "#b45309" : "#475569",
                        }}
                      >
                        {flag.type.replace(/_/g, " ")} · {flag.severity.toUpperCase()}
                      </span>
                      <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>
                        <Icon name="clock" size={12} /> {flag.timestamp}
                      </span>
                    </div>

                    {/* Metric indicator if exists */}
                    {flag.metrics && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          background: "#ffffff",
                          border: "1px dashed #cbd5e1",
                          marginBottom: "12px",
                          fontSize: "12px",
                        }}
                      >
                        {flag.metrics.doScore !== undefined && flag.metrics.defendScore !== undefined && (
                          <div style={{ display: "flex", gap: "12px", width: "100%", justifyContent: "space-between" }}>
                            <span>
                              Amaliy ijro (DO): <strong>{flag.metrics.doScore}%</strong>
                            </span>
                            <span>
                              AI Viva (DEFEND): <strong>{flag.metrics.defendScore}%</strong>
                            </span>
                            <span style={{ color: "#dc2626", fontWeight: 800 }}>
                              Farq: {flag.metrics.discrepancy} ball (≥ 35)
                            </span>
                          </div>
                        )}
                        {flag.metrics.model1Score !== undefined && flag.metrics.model2Score !== undefined && (
                          <div style={{ display: "flex", gap: "12px", width: "100%", justifyContent: "space-between" }}>
                            <span>
                              Model #1: <strong>{flag.metrics.model1Score} b</strong>
                            </span>
                            <span>
                              Model #2: <strong>{flag.metrics.model2Score} b</strong>
                            </span>
                            <span style={{ color: "#d97706", fontWeight: 800 }}>
                              Kelishmovchilik: {flag.metrics.discrepancy} b
                            </span>
                          </div>
                        )}
                        {flag.metrics.similarityPct !== undefined && (
                          <div style={{ width: "100%", color: "#dc2626", fontWeight: 700 }}>
                            AST Daraxt o‘xshashligi: <strong>{flag.metrics.similarityPct}%</strong> (Plagiat xavfi)
                          </div>
                        )}
                        {flag.metrics.latencySeconds !== undefined && (
                          <div style={{ width: "100%", color: "#b45309", fontWeight: 700 }}>
                            Savoldan keyingi sukut davomiyligi: <strong>{flag.metrics.latencySeconds} soniya</strong>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Narrative Reason Box */}
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: "10px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        marginBottom: "16px",
                        fontSize: "12.5px",
                        color: "#334155",
                        lineHeight: "1.55",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          color: "var(--navy)",
                          fontSize: "11px",
                          fontWeight: 800,
                          marginBottom: "4px",
                        }}
                      >
                        <Icon name="alert" size={13} />
                        <span>ANOMALIYA TAVSIFI:</span>
                      </div>
                      {flag.reason}
                    </div>

                    {/* Action buttons (both aligned with equal height) */}
                    <div className="candidate-actions-row">
                      <button
                        type="button"
                        className="candidate-evidence-btn"
                        onClick={() => {
                          setActiveFlag(flag);
                          setReviewNotes("");
                        }}
                      >
                        <Icon name="file" size={16} />
                        <span>Viva dialogini ko‘rish</span>
                      </button>

                      {flag.status === "open" ? (
                        <button
                          type="button"
                          className="candidate-invite-btn"
                          onClick={() => handleResolve(flag.id, "Asossiz deb topildi va yopildi")}
                        >
                          <Icon name="checkCircle" size={16} />
                          <span>Asossiz (Oqlash)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="candidate-invite-btn is-invited"
                          disabled
                          style={{ cursor: "default" }}
                        >
                          <Icon name="check" size={16} />
                          <span>Ko‘rib chiqilgan</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: VIVA TRANSKRIPT TEKSHIRUVI (AI VIVA TRANSCRIPTS) */}
      {currentTab === "transcripts" && (
        <section className="card" style={{ padding: "26px", marginBottom: "26px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <div>
              <p className="card-kicker" style={{ margin: 0 }}>
                AI VIVA HIMOYA SESSIYALARI
              </p>
              <h2 style={{ margin: "4px 0" }}>Talabalar og‘zaki audio transkriptlari</h2>
              <span style={{ fontSize: "12.5px", color: "var(--muted)" }}>
                Savol-javoblar audio yozuvi, nutq matni va avtomatlashtirilgan ishonchlilik indeksi
              </span>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Talaba yoki topshiriq nomi..."
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1.5px solid var(--border)",
                  fontSize: "13px",
                  outline: "none",
                  background: "#f8fafc",
                }}
              />
              <select
                value={transcriptFilter}
                onChange={(e) => setTranscriptFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1.5px solid var(--border)",
                  fontSize: "13px",
                  background: "#ffffff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <option value="all">Barcha holatlar</option>
                <option value="verified">✅ Tasdiqlangan</option>
                <option value="flagged">🚩 Bayroq qo‘yilgan</option>
                <option value="review_needed">⏳ Tekshiruv kutilmoqda</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {filteredTranscripts.map((t) => {
              const isExpanded = expandedTranscriptId === t.id;
              const isPlaying = playingTranscriptId === t.id;

              return (
                <div
                  key={t.id}
                  style={{
                    borderRadius: "14px",
                    border: "1.5px solid #e2e8f0",
                    background: "#ffffff",
                    overflow: "hidden",
                    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)",
                  }}
                >
                  {/* Card Header Bar */}
                  <div
                    style={{
                      padding: "16px 20px",
                      background: "#f8fafc",
                      borderBottom: isExpanded ? "1px solid #e2e8f0" : "none",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <button
                        type="button"
                        onClick={() => handleTogglePlay(t.id)}
                        style={{
                          width: "38px",
                          height: "38px",
                          borderRadius: "50%",
                          border: "none",
                          background: isPlaying ? "#dc2626" : "var(--royal)",
                          color: "#ffffff",
                          display: "grid",
                          placeItems: "center",
                          cursor: "pointer",
                          boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)",
                          transition: "transform 0.15s ease",
                        }}
                        title={isPlaying ? "Audioni to‘xtatish" : "Audioni eshitish"}
                      >
                        <Icon name={isPlaying ? "close" : "play"} size={16} />
                      </button>

                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <strong style={{ fontSize: "16px", color: "var(--navy)" }}>{t.studentName}</strong>
                          <span style={{ fontSize: "12px", color: "var(--muted)" }}>({t.studentGroup})</span>
                          <span
                            style={{
                              padding: "2px 7px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: 700,
                              background:
                                t.status === "verified"
                                  ? "#ecfdf5"
                                  : t.status === "flagged"
                                  ? "#fee2e2"
                                  : "#fef3c7",
                              color:
                                t.status === "verified"
                                  ? "#059669"
                                  : t.status === "flagged"
                                  ? "#dc2626"
                                  : "#d97706",
                            }}
                          >
                            {t.status === "verified"
                              ? "Tasdiqlangan"
                              : t.status === "flagged"
                              ? "Bayroq qo‘yilgan"
                              : "Qayta tahlil"}
                          </span>
                        </div>
                        <div style={{ fontSize: "12.5px", color: "#475569", marginTop: "2px" }}>
                          {t.taskTitle} · <span style={{ color: "var(--muted)" }}>{t.date} ({t.duration})</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 700 }}>
                          VIVA BALI / INTEGRITY
                        </div>
                        <strong style={{ fontSize: "16px", color: "var(--royal)" }}>
                          {t.overallScore}/100{" "}
                          <span style={{ fontSize: "12px", color: t.integrityScore < 70 ? "#dc2626" : "#059669" }}>
                            ({t.integrityScore}% ishonch)
                          </span>
                        </strong>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedTranscriptId(isExpanded ? null : t.id)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "var(--navy)",
                          cursor: "pointer",
                        }}
                      >
                        {isExpanded ? "Yig‘ish ▲" : "Tafsilotlar ▼"}
                      </button>
                    </div>
                  </div>

                  {/* Audio Playing Bar */}
                  {isPlaying && (
                    <div
                      style={{
                        padding: "12px 20px",
                        background: "#0f2744",
                        color: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                      }}
                    >
                      <Icon name="play" size={16} />
                      <span style={{ fontSize: "12px", fontWeight: 700 }}>
                        Audio ijro etilmoqda ({t.studentName})
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: "6px",
                          borderRadius: "4px",
                          background: "rgba(255, 255, 255, 0.2)",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${audioProgress}%`,
                            height: "100%",
                            background: "#38bdf8",
                            borderRadius: "4px",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: "11px", color: "#94a3b8" }}>03:45 / {t.duration}</span>
                    </div>
                  )}

                  {/* Expanded QA Pairs List */}
                  {isExpanded && (
                    <div style={{ padding: "20px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        {t.qaPairs.map((qa, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: "14px 16px",
                              borderRadius: "10px",
                              background: qa.flagRaised ? "#fff1f2" : "#f8fafc",
                              border: qa.flagRaised ? "1.5px solid #fecdd3" : "1px solid #e2e8f0",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "6px",
                              }}
                            >
                              <strong style={{ fontSize: "13px", color: "var(--navy)" }}>
                                🎙️ Savol #{idx + 1} (AI Examiner):
                              </strong>
                              <span
                                style={{
                                  fontSize: "11.5px",
                                  fontWeight: 700,
                                  color: qa.evaluatorScore < 50 ? "#dc2626" : "#059669",
                                }}
                              >
                                Baho: {qa.evaluatorScore}/100 · Nutq ishonchliligi: {qa.audioConfidence}%
                              </span>
                            </div>
                            <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#1e293b", fontWeight: 600 }}>
                              {qa.question}
                            </p>

                            <div
                              style={{
                                padding: "10px 12px",
                                borderRadius: "8px",
                                background: "#ffffff",
                                border: "1px solid #e2e8f0",
                                fontSize: "12.5px",
                                color: "#334155",
                                fontStyle: "italic",
                              }}
                            >
                              <strong>Talaba javobi:</strong> "{qa.answer}"
                            </div>

                            {qa.flagRaised && (
                              <div
                                style={{
                                  marginTop: "8px",
                                  fontSize: "12px",
                                  color: "#b91c1c",
                                  fontWeight: 700,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "5px",
                                }}
                              >
                                <Icon name="alert" size={13} />
                                <span>Shubhali javob: Talaba o‘z yozgan kodi mohiyatini tushuntirib bera olmadi.</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Moderator Decision Footer */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: "10px",
                          marginTop: "16px",
                          paddingTop: "14px",
                          borderTop: "1px solid #f1f5f9",
                        }}
                      >
                        <button
                          type="button"
                          className="candidate-evidence-btn"
                          style={{ maxWidth: "220px" }}
                          onClick={() => handleTranscriptVerdict(t.id, "verified", "Transkript tasdiqlandi")}
                        >
                          <Icon name="checkCircle" size={16} />
                          <span>Tasdiqlash (Qoniqarli)</span>
                        </button>
                        <button
                          type="button"
                          className="candidate-invite-btn"
                          style={{ maxWidth: "240px", background: "#dc2626" }}
                          onClick={() => handleTranscriptVerdict(t.id, "flagged", "Bayroq ro‘yxatiga kiritildi")}
                        >
                          <Icon name="shield" size={16} />
                          <span>Bayroq qo‘yish (Shubhali)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 3: ONTOLOGIYA & RUBRIKALAR (INTEGRITY RULES & THRESHOLDS) */}
      {currentTab === "rules" && (
        <section className="card" style={{ padding: "26px", marginBottom: "26px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "14px",
              marginBottom: "22px",
            }}
          >
            <div>
              <p className="card-kicker" style={{ margin: 0 }}>
                ANTI-FRAUD VA INTEGRITY ALGORITMLARI
              </p>
              <h2 style={{ margin: "4px 0" }}>Avtomatlashtirilgan Halollik Qoidalari</h2>
              <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0, maxWidth: "680px" }}>
                Talabalarning Fake Skill va Cheat qilishini oldini oluvchi chegara qiymatlari (Thresholds). Ushbu parametrlar bo‘yicha buzilish aniqlansa, tizim avtomatik bayroq yaratadi.
              </p>
            </div>

            <button
              type="button"
              className="candidate-invite-btn"
              style={{ padding: "10px 18px", maxWidth: "220px" }}
              onClick={() => showToast("Barcha qoidalar va ontologiya mezonlari muvaffaqiyatli saqlandi!")}
            >
              <Icon name="checkCircle" size={16} />
              <span>Qoidalarni saqlash</span>
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {rules.map((rule) => {
              const isHigh = rule.severity === "high";
              const isMed = rule.severity === "medium";

              return (
                <div
                  key={rule.id}
                  style={{
                    padding: "20px 22px",
                    borderRadius: "14px",
                    border: "1.5px solid #e2e8f0",
                    background: rule.isActive ? "#ffffff" : "#f8fafc",
                    opacity: rule.isActive ? 1 : 0.6,
                    transition: "all 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "10px",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 800,
                            background: isHigh ? "#fee2e2" : isMed ? "#fef3c7" : "#f1f5f9",
                            color: isHigh ? "#dc2626" : isMed ? "#b45309" : "#475569",
                          }}
                        >
                          {rule.code} · {rule.severity.toUpperCase()}
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>
                          Ishga tushgan: {rule.triggeredCount} marta
                        </span>
                      </div>
                      <h3 style={{ margin: "2px 0", fontSize: "16.5px", color: "var(--navy)" }}>
                        {rule.name}
                      </h3>
                    </div>

                    {/* Toggle Switch */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: rule.isActive ? "#059669" : "var(--muted)" }}>
                        {rule.isActive ? "FAOL" : "TO‘XTATILGAN"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleRule(rule.id)}
                        style={{
                          width: "48px",
                          height: "26px",
                          borderRadius: "14px",
                          border: "none",
                          background: rule.isActive ? "#059669" : "#cbd5e1",
                          position: "relative",
                          cursor: "pointer",
                          transition: "background 0.2s ease",
                        }}
                        aria-label="Qoidani yoqish/o‘chirish"
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: "3px",
                            left: rule.isActive ? "25px" : "3px",
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            background: "#ffffff",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                            transition: "left 0.2s ease",
                          }}
                        />
                      </button>
                    </div>
                  </div>

                  <p style={{ margin: "8px 0 14px", fontSize: "13px", color: "#334155", lineHeight: "1.5" }}>
                    {rule.description}
                  </p>

                  {/* Interactive Slider & Formula */}
                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: "10px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "14px",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: "260px" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "var(--navy)",
                          marginBottom: "6px",
                        }}
                      >
                        <span>TRIGER CHEGARASI:</span>
                        <strong style={{ color: "var(--royal)", fontSize: "13.5px" }}>
                          ≥ {rule.threshold} {rule.unit}
                        </strong>
                      </div>
                      <input
                        type="range"
                        min={rule.category === "similarity" ? "50" : "10"}
                        max={rule.category === "similarity" ? "99" : "150"}
                        value={rule.threshold}
                        disabled={!rule.isActive}
                        onChange={(e) => handleThresholdChange(rule.id, Number(e.target.value))}
                        style={{ width: "100%", accentColor: "var(--royal)", cursor: "pointer" }}
                      />
                    </div>

                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        fontSize: "12px",
                        color: "#475569",
                        maxWidth: "380px",
                      }}
                    >
                      <strong style={{ color: "var(--navy)" }}>Qoida mantig‘i:</strong> {rule.explanation}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Review Dialog Modal (Holat tahlili & Transkript ekspertizasi) */}
      {activeFlag && (
        <div
          className="modal-backdrop employer-modal-backdrop"
          role="presentation"
          onMouseDown={() => setActiveFlag(null)}
        >
          <div
            className="modal employer-modal"
            style={{ maxWidth: "660px", borderRadius: "20px", padding: "28px" }}
            role="dialog"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setActiveFlag(null)}>
              <Icon name="close" />
            </button>
            <div
              className="modal-symbol"
              style={{
                background:
                  activeFlag.severity === "high"
                    ? "linear-gradient(135deg, #7f1d1d, #991b1b)"
                    : "linear-gradient(135deg, #0f2744, #1e3a5f)",
                color: "white",
              }}
            >
              <Icon name="shield" size={30} />
            </div>

            <p className="eyebrow" style={{ color: "var(--royal)" }}>
              HUMAN-IN-THE-LOOP · MODERATSIYA EKSPERTIZASI
            </p>
            <h2 style={{ fontSize: "22px", margin: "4px 0" }}>
              {activeFlag.studentName} · Holat tahlili
            </h2>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "18px" }}>
              Ko‘nikma: <strong>{activeFlag.skillName}</strong> · Turi: <strong>{activeFlag.type}</strong>
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                textAlign: "left",
                marginBottom: "20px",
              }}
            >
              {/* Reason card */}
              <div
                style={{
                  padding: "13px 15px",
                  borderRadius: "12px",
                  background: "#fff1f2",
                  border: "1px solid #fecdd3",
                  fontSize: "12.5px",
                  color: "#9f1239",
                  lineHeight: "1.55",
                }}
              >
                <strong>Tizim xulosasi:</strong> {activeFlag.reason}
              </div>

              {/* AI Viva Dialog Transcript */}
              {activeFlag.transcriptExcerpt && (
                <div
                  style={{
                    padding: "15px",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid var(--border)",
                    fontSize: "12.5px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "var(--navy)",
                      fontWeight: 800,
                      marginBottom: "8px",
                      fontSize: "11.5px",
                    }}
                  >
                    <Icon name="file" size={14} />
                    <span>AI VIVA HIMOYA DIALOGI PARCHASI:</span>
                  </div>

                  <p style={{ margin: "0 0 6px", color: "var(--navy)", fontWeight: 600 }}>
                    🎙️ <strong>AI Examiner:</strong> "{activeFlag.transcriptExcerpt.question}"
                  </p>
                  <p
                    style={{
                      margin: "0 0 10px",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      color: "#334155",
                      fontStyle: "italic",
                    }}
                  >
                    🗣️ <strong>Talaba javobi:</strong> "{activeFlag.transcriptExcerpt.answer}"
                  </p>

                  <div style={{ color: "#b91c1c", fontWeight: 700, fontSize: "12px" }}>
                    ⚖️ <strong>AI baholash xulosasi:</strong> {activeFlag.transcriptExcerpt.aiVerdict}
                  </div>
                </div>
              )}

              {/* Moderator Notes Box */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    color: "var(--muted)",
                    marginBottom: "6px",
                    letterSpacing: "0.04em",
                  }}
                >
                  MODERATOR QARORI ASOSI VA IZOHI:
                </label>
                <textarea
                  rows={2}
                  placeholder="Talaba bilan o‘tkazilgan suhbat yoki kod tahlili bo‘yicha xulosa yozing..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1.5px solid var(--border)",
                    fontSize: "12.5px",
                    outline: "none",
                    fontFamily: "inherit",
                    resize: "none",
                  }}
                />
              </div>
            </div>

            {/* Verdict Action Buttons */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="candidate-evidence-btn"
                style={{ flex: 1 }}
                onClick={() => handleResolve(activeFlag.id, "Talaba javobi qoniqarli deb topildi (Oqlandi)")}
              >
                <Icon name="checkCircle" size={16} />
                <span>Asossiz deb topish (Oqlash)</span>
              </button>

              <button
                type="button"
                className="candidate-invite-btn"
                style={{ flex: 1.2, background: "linear-gradient(135deg, #b91c1c, #991b1b)" }}
                onClick={() =>
                  handleResolve(
                    activeFlag.id,
                    "Qayta og‘zaki Viva tayinlandi va sertifikat darajasi to‘xtatildi"
                  )
                }
              >
                <Icon name="shield" size={16} />
                <span>Qayta Insoniy Viva tayinlash</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="toast">
          <Icon name="check" /> {toastMessage}
          <button onClick={() => setToastMessage(null)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
