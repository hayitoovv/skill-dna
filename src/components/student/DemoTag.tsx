export const isDemoText = (...texts: (string | null | undefined)[]) =>
  texts.some((t) => !!t && t.toLowerCase().includes("namuna"))

export const mutedState = {
  textAlign: "center" as const,
  padding: "36px 24px",
  color: "var(--muted)",
  fontSize: "14px",
}

export const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

export function StatusChip({
  label,
  tone,
}: {
  label: string
  tone: "success" | "muted" | "accent"
}) {
  const colors =
    tone === "success"
      ? { background: "var(--success-soft)", color: "var(--success-fg)" }
      : tone === "accent"
        ? { background: "var(--accent-soft)", color: "var(--accent)" }
        : { background: "var(--surface-3)", color: "var(--muted)" }
  return (
    <span
      style={{
        fontSize: "11.5px",
        fontWeight: 700,
        padding: "2px 9px",
        borderRadius: "999px",
        whiteSpace: "nowrap",
        ...colors,
      }}
    >
      {label}
    </span>
  )
}

export default function DemoTag() {
  return (
    <span
      title="Namuna ma’lumot — korxonaning haqiqiy ko‘rsatkichi emas"
      style={{
        fontSize: "11px",
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: "999px",
        background: "var(--surface-3)",
        color: "var(--muted)",
        whiteSpace: "nowrap",
      }}
    >
      namuna
    </span>
  )
}
