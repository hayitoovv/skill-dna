import React, { Component, type ReactNode } from "react";
import Icon from "./Icons";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[SKILL DNA Error Boundary caught error]:", error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.removeItem("skill_dna_page");
    } catch {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleClearAll = () => {
    try {
      localStorage.clear();
    } catch {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "24px",
            background: "#0f172a",
            color: "#f8fafc",
            fontFamily: "system-ui, -apple-system, sans-serif",
            textAlign: "center",
          }}
        >
          <div
            style={{
              maxWidth: "520px",
              background: "#1e293b",
              padding: "36px",
              borderRadius: "16px",
              border: "1px solid #334155",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "12px",
                background: "rgba(239, 68, 68, 0.15)",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <Icon name="alertTriangle" size={28} />
            </div>
            <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 10px" }}>
              Kutilmagan xatolik yuz berdi
            </h1>
            <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: "1.6", margin: "0 0 20px" }}>
              Ilovada vaqtinchalik xatolik paydo bo‘ldi. Qayta yuklash tugmasi orqali sahifani yangilashingiz mumkin.
            </p>
            {this.state.error && (
              <pre
                style={{
                  background: "#090d16",
                  padding: "12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#fca5a5",
                  overflowX: "auto",
                  textAlign: "left",
                  margin: "0 0 24px",
                  border: "1px solid #7f1d1d",
                }}
              >
                {this.state.error.message}
              </pre>
            )}
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  background: "#0284c7",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Qayta yuklash
              </button>
              <button
                type="button"
                onClick={this.handleClearAll}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  background: "transparent",
                  color: "#cbd5e1",
                  border: "1px solid #475569",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Keshni tozalash va kirish
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
