import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { currentOverride, originalText, removeLocalOverride, setLocalOverride } from "./siteText";

const EDIT_EVENT = "skilldna:cms-edit";
let editing = false;

export function isEditMode() {
  return editing;
}

export function setEditMode(on: boolean) {
  editing = on;
  document.body.classList.toggle("cms-editing", on);
  window.dispatchEvent(new CustomEvent(EDIT_EVENT, { detail: on }));
}

/** The text node under the pointer (exact node, not just the element). */
function textNodeAt(x: number, y: number): Text | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  let node: Node | null = null;
  if (doc.caretPositionFromPoint) node = doc.caretPositionFromPoint(x, y)?.offsetNode ?? null;
  else if (doc.caretRangeFromPoint) node = doc.caretRangeFromPoint(x, y)?.startContainer ?? null;
  if (node && node.nodeType === Node.TEXT_NODE && node.nodeValue?.trim()) {
    // caret APIs snap to the nearest text; make sure the pointer is really over it
    const range = document.createRange();
    range.selectNodeContents(node);
    const hit = [...range.getClientRects()].some((r) => x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2);
    if (hit) return node as Text;
  }
  return null;
}

const insideEditorUi = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest("[data-cms-ignore]");

interface Target {
  node: Text;
  source: string;
  value: string;
  x: number;
  y: number;
}

/** In-page text editor for super admins: hover highlights text, click opens the editor. */
export default function ContentEditor() {
  const [on, setOn] = useState(editing);
  const [paused, setPaused] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const hovered = useRef<Element | null>(null);

  useEffect(() => {
    const onToggle = (e: Event) => {
      setOn((e as CustomEvent<boolean>).detail);
      setPaused(false);
      setTarget(null);
    };
    window.addEventListener(EDIT_EVENT, onToggle);
    return () => {
      window.removeEventListener(EDIT_EVENT, onToggle);
      document.body.classList.remove("cms-editing");
    };
  }, []);

  const active = on && !paused;

  useEffect(() => {
    if (!active) {
      hovered.current?.classList.remove("cms-hover");
      return;
    }
    const clearHover = () => {
      hovered.current?.classList.remove("cms-hover");
      hovered.current = null;
    };
    const onMove = (e: MouseEvent) => {
      if (insideEditorUi(e.target)) return clearHover();
      const node = textNodeAt(e.clientX, e.clientY);
      const el = node?.parentElement ?? null;
      if (el === hovered.current) return;
      clearHover();
      if (el) {
        el.classList.add("cms-hover");
        hovered.current = el;
      }
    };
    // Capture phase on window: runs before React's handlers, so buttons/links don't fire while editing
    const block = (e: Event) => {
      if (insideEditorUi(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const onClick = (e: MouseEvent) => {
      if (insideEditorUi(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      const node = textNodeAt(e.clientX, e.clientY);
      // Same exclusions as the override engine (code samples, text areas, the admin's own tables)
      if (!node || node.parentElement?.closest("[data-cms-ignore], script, style, textarea, code, pre")) return;
      const source = originalText(node);
      const value = currentOverride(source) ?? source;
      setTarget({ node, source, value, x: e.clientX, y: e.clientY });
      setDraft(value);
      setError(null);
    };
    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("click", onClick, true);
    for (const type of ["mousedown", "mouseup", "pointerdown", "submit", "dblclick", "auxclick"]) window.addEventListener(type, block, true);
    return () => {
      clearHover();
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("click", onClick, true);
      for (const type of ["mousedown", "mouseup", "pointerdown", "submit", "dblclick", "auxclick"]) window.removeEventListener(type, block, true);
    };
  }, [active]);

  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (target) setTarget(null);
      else setEditMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on, target]);

  if (!on) return null;

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const save = async () => {
    if (!target) return;
    const value = draft.trim();
    if (!value) return setError("Matn bo‘sh bo‘lishi mumkin emas");
    setBusy(true);
    setError(null);
    try {
      if (value === target.source) {
        await api.adminRevertText(target.source);
        removeLocalOverride(target.source);
      } else {
        await api.adminSaveText(target.source, value);
        setLocalOverride(target.source, value);
      }
      setTarget(null);
      flash("Saqlandi — barcha foydalanuvchilarda yangilanadi");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlanmadi");
    } finally {
      setBusy(false);
    }
  };

  const revert = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await api.adminRevertText(target.source);
      removeLocalOverride(target.source);
      setTarget(null);
      flash("Asl matn tiklandi");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tiklanmadi");
    } finally {
      setBusy(false);
    }
  };

  const overridden = target ? currentOverride(target.source) !== undefined : false;
  const popLeft = target ? Math.min(Math.max(12, target.x - 180), window.innerWidth - 392) : 0;
  const popTop = target ? (target.y + 300 > window.innerHeight ? Math.max(12, target.y - 300) : target.y + 16) : 0;

  return (
    <div data-cms-ignore>
      <div className="cms-toolbar">
        <span className="cms-dot" />
        <strong>{paused ? "Tahrirlash to‘xtatilgan" : "Tahrirlash rejimi"}</strong>
        <span className="cms-hint">{paused ? "Sahifada bemalol harakatlaning" : "O‘zgartirmoqchi bo‘lgan matn ustiga bosing"}</span>
        <button type="button" onClick={() => setPaused((p) => !p)}>
          {paused ? "Davom ettirish" : "Pauza"}
        </button>
        <button type="button" className="cms-exit" onClick={() => setEditMode(false)}>
          Chiqish
        </button>
      </div>

      {target && (
        <div className="cms-pop" style={{ left: popLeft, top: popTop }} role="dialog" aria-label="Matnni tahrirlash">
          <div className="cms-pop-label">Asl matn</div>
          <div className="cms-pop-source">{target.source}</div>
          <div className="cms-pop-label">Yangi matn</div>
          <textarea
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void save();
            }}
            rows={Math.min(6, Math.max(2, Math.ceil(draft.length / 42)))}
          />
          {error && <div className="cms-pop-error">{error}</div>}
          <div className="cms-pop-actions">
            {overridden && (
              <button type="button" className="cms-link" disabled={busy} onClick={() => void revert()}>
                Asliga qaytarish
              </button>
            )}
            <span style={{ flex: 1 }} />
            <button type="button" className="cms-secondary" onClick={() => setTarget(null)}>
              Bekor
            </button>
            <button type="button" className="cms-primary" disabled={busy || !draft.trim()} onClick={() => void save()}>
              {busy ? "…" : "Saqlash"}
            </button>
          </div>
          <div className="cms-pop-note">Bir xil matn saytning barcha joyida almashadi. Ctrl+Enter — saqlash.</div>
        </div>
      )}

      {toast && <div className="cms-toast">{toast}</div>}
    </div>
  );
}
