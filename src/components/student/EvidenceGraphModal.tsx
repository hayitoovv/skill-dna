import { useState, useEffect } from "react";
import { Icon } from "../common/Icons";
import { api } from "../../services/api";

interface EvidenceGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  skillName?: string;
}

export default function EvidenceGraphModal({
  isOpen,
  onClose,
  skillName = "Backend va REST API",
}: EvidenceGraphModalProps) {
  const [data, setData] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api
        .getEvidenceGraph()
        .then((res) => {
          setData(res);
          if (res.nodes && res.nodes.length > 0) {
            setSelectedNode(res.nodes[0]);
          }
        })
        .catch(() => {
          setData({
            nodes: [
              { id: "task-1", label: "Token Bucket Rate Limiter", type: "task", status: "completed" },
              { id: "sub-1", label: "Python Middleware Code (v2.1)", type: "submission", status: "verified" },
              { id: "test-1", label: "4/4 PyTest Concurrency Tests", type: "tests", status: "passed", score: 100.0 },
              { id: "adapt-1", label: "Deadlock Parameter Challenge", type: "challenge", status: "adapted", score: 85.0 },
              { id: "viva-1", label: "AI Viva Architectural Defense", type: "viva", status: "defended", score: 88.0 },
              { id: "ev-1", label: "Evidence: Backend DO & DEFEND", type: "evidence", status: "verified", score: 85.0 },
              { id: "score-1", label: "Skill Score: 83/100 (Confidence: 81%)", type: "score", status: "active", score: 83.0 },
            ],
            edges: [],
          });
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: "780px", width: "95%" }}
      >
        <button className="modal-close" aria-label="Yopish" onClick={onClose}>
          <Icon name="close" />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "linear-gradient(135deg, var(--success-400), var(--success))", display: "grid", placeItems: "center", color: "#fff" }}>
            <Icon name="dna" size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: "20px", margin: 0 }}>Evidence Graph (Dalillar Zanjiri)</h2>
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
                {node.score !== undefined && (
                  <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--emerald)" }}>
                    {node.score} ball
                  </span>
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
