import { useState, useEffect } from "react";
import { Icon } from "../common/Icons";
import { api } from "../../services/api";

interface EvidenceGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  skillName?: string;
  skillId?: string;
}

type GraphNode = {
  id: string;
  label: string;
  type: string;
  layer?: string;
  status?: string;
  score?: number | null;
  verified_by?: string;
  created_at?: string;
};
type GraphEdge = { source: string; target: string; type: string };

const LAYER_ORDER = ["KNOW", "DO", "ADAPT", "DEFEND", "PROVE"];
const LAYER_COLOR: Record<string, string> = {
  KNOW: "var(--royal)",
  DO: "var(--emerald)",
  ADAPT: "var(--violet)",
  DEFEND: "var(--amber)",
  PROVE: "var(--rose)",
};

const demoNodes: GraphNode[] = [
  { id: "task-1", label: "Token Bucket Rate Limiter", type: "task", status: "completed" },
  { id: "sub-1", label: "Python Middleware Code (v2.1)", type: "submission", status: "verified" },
  { id: "test-1", label: "4/4 PyTest Concurrency Tests", type: "tests", status: "passed", score: 100.0 },
  { id: "adapt-1", label: "Deadlock Parameter Challenge", type: "challenge", status: "adapted", score: 85.0 },
  { id: "viva-1", label: "AI Viva Architectural Defense", type: "viva", status: "defended", score: 88.0 },
  { id: "ev-1", label: "Evidence: Backend DO & DEFEND", type: "evidence", status: "verified", score: 85.0 },
  { id: "score-1", label: "Skill Score: 83/100 (Confidence: 81%)", type: "score", status: "active", score: 83.0 },
];

function SourcePill({ live }: { live: boolean }) {
  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 800,
        padding: "3px 9px",
        borderRadius: "999px",
        background: live ? "var(--success-soft)" : "var(--warning-soft)",
        color: live ? "var(--success-fg)" : "var(--warning-fg)",
        whiteSpace: "nowrap",
      }}
    >
      {live ? "Jonli ma’lumot" : "Demo ma’lumot"}
    </span>
  );
}

function fmtScore(s: number | null | undefined) {
  return s == null ? null : Math.round(s * 10) / 10;
}

export default function EvidenceGraphModal({
  isOpen,
  onClose,
  skillName = "Backend va REST API",
  skillId,
}: EvidenceGraphModalProps) {
  const [data, setData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });
  const [source, setSource] = useState<"live" | "demo">("live");
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    api
      .getEvidenceGraph(skillId)
      .then((res) => {
        setData({ nodes: res.nodes ?? [], edges: res.edges ?? [] });
        setSource("live");
        setSelectedNode(null);
      })
      .catch(() => {
        setData({ nodes: demoNodes, edges: [] });
        setSource("demo");
        setSelectedNode(demoNodes[0]);
      })
      .finally(() => setLoading(false));
  }, [isOpen, skillId]);

  if (!isOpen) return null;

  const live = source === "live";
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const scoreNodes = data.nodes.filter((n) => n.type === "score");
  const evidenceNodes = data.nodes.filter((n) => n.type !== "score");
  const supportsOf = (scoreId: string) =>
    data.edges
      .filter((e) => e.type === "supports" && e.target === scoreId)
      .map((e) => byId.get(e.source))
      .filter((n): n is GraphNode => !!n)
      .sort((a, b) => LAYER_ORDER.indexOf(a.layer ?? "") - LAYER_ORDER.indexOf(b.layer ?? ""));
  const derivedFrom = (id: string) =>
    data.edges
      .filter((e) => e.type === "derived_from" && e.source === id)
      .map((e) => byId.get(e.target))
      .filter((n): n is GraphNode => !!n);
  const attached = new Set(data.edges.filter((e) => e.type === "supports").map((e) => e.source));
  const orphans = evidenceNodes.filter((n) => !attached.has(n.id));

  const renderEvidence = (node: GraphNode) => {
    const parents = derivedFrom(node.id);
    const isSel = selectedNode?.id === node.id;
    const color = LAYER_COLOR[node.layer ?? ""] ?? "var(--accent)";
    return (
      <div
        key={node.id}
        onClick={() => setSelectedNode(node)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          padding: "10px 14px",
          marginLeft: "18px",
          background: isSel ? "var(--accent-soft)" : "var(--surface-2)",
          border: isSel ? "1.5px solid var(--accent-400)" : "1px solid var(--border)",
          borderLeft: `4px solid ${color}`,
          borderRadius: "9px",
          cursor: "pointer",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <strong style={{ fontSize: "14px", color: "var(--navy)", display: "block" }}>{node.label}</strong>
          <span style={{ fontSize: "11.5px", color: "var(--muted)", letterSpacing: "0.03em" }}>
            <b style={{ color }}>{node.layer ?? node.type.toUpperCase()}</b> · {node.status}
            {node.verified_by ? ` · tekshirgan: ${node.verified_by.startsWith("human") ? "inson (o‘qituvchi)" : node.verified_by}` : ""}
          </span>
          {parents.length > 0 && (
            <span style={{ display: "block", fontSize: "11.5px", color: "var(--text-3)", marginTop: "2px" }}>
              ↳ asoslanadi: {parents.map((p) => p.label).join(", ")}
            </span>
          )}
        </div>
        {fmtScore(node.score) != null && (
          <span style={{ fontSize: "14.5px", fontWeight: 800, color: "var(--emerald)", whiteSpace: "nowrap" }}>
            {fmtScore(node.score)} ball
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: "780px", width: "95%", maxHeight: "90vh", overflowY: "auto" }}
      >
        <button className="modal-close" aria-label="Yopish" onClick={onClose}>
          <Icon name="close" />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "linear-gradient(135deg, var(--success-400), var(--success))", display: "grid", placeItems: "center", color: "#fff" }}>
            <Icon name="dna" size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: "20px", margin: 0, display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              Evidence Graph (Dalillar Zanjiri) {!loading && <SourcePill live={live} />}
            </h2>
            <span style={{ fontSize: "13px", color: "var(--muted)" }}>
              {skillName} · PostgreSQL da saqlanuvchi tekshiriladigan zanjir
            </span>
          </div>
        </div>

        <p style={{ fontSize: "13.5px", color: "var(--muted)", margin: "0 0 16px" }}>
          SKILL DNA platformasida har bir ball shunchaki raqam emas — u tekshiriladigan dalillar zanjiriga (Evidence Graph) asoslanadi:
        </p>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>Graf yuklanmoqda...</div>
        ) : live ? (
          data.nodes.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "var(--muted)", fontSize: "14px" }}>
              Hali dalillar qayd etilmagan. Birinchi topshiriqni bajaring — natija shu zanjirda paydo bo‘ladi.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                {evidenceNodes.length} ta dalil · {scoreNodes.length} ta ko‘nikma bahosi · {data.edges.length} ta bog‘lanish
              </span>
              {scoreNodes.map((sn) => {
                const supports = supportsOf(sn.id);
                return (
                  <div key={sn.id} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        padding: "12px 16px",
                        background: "var(--success-soft)",
                        border: "1px solid var(--success-300)",
                        borderRadius: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Icon name="target" size={18} />
                        <div>
                          <strong style={{ fontSize: "14.5px", color: "var(--navy)", display: "block" }}>{sn.label}</strong>
                          <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                            Daraja: {sn.status} · {supports.length} ta dalil qo‘llab-quvvatlaydi
                          </span>
                        </div>
                      </div>
                    </div>
                    {supports.map(renderEvidence)}
                  </div>
                );
              })}
              {orphans.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <strong style={{ fontSize: "13px", color: "var(--text-3)" }}>Bog‘lanmagan dalillar</strong>
                  {orphans.map(renderEvidence)}
                </div>
              )}
            </div>
          )
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
            {data.nodes.map((node, index) => (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background: selectedNode?.id === node.id ? "var(--accent-soft)" : "var(--surface-2)",
                  border: selectedNode?.id === node.id ? "1.5px solid var(--accent-400)" : "1px solid var(--border)",
                  borderRadius: "9px",
                  cursor: "pointer",
                  transition: "0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "50%",
                      background: node.type === "score" ? "var(--success-400)" : "var(--accent)",
                      color: "#fff",
                      fontSize: "12.5px",
                      fontWeight: 800,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <strong style={{ fontSize: "14.5px", color: "var(--navy)", display: "block" }}>{node.label}</strong>
                    <span style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Turi: {node.type} · Holat: {node.status}
                    </span>
                  </div>
                </div>
                {node.score != null && (
                  <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--emerald)" }}>{node.score} ball</span>
                )}
              </div>
            ))}
          </div>
        )}

        <button className="primary-button full" onClick={onClose}>
          Tushunarli
        </button>
      </div>
    </div>
  );
}
