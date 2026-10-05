/**
 * Site text overrides (super-admin CMS).
 *
 * Every override maps an exact on-screen text to a replacement. A MutationObserver applies the map to every
 * text node and to placeholder/title/aria-label attributes as React renders them, so any wording on any page —
 * including strings written directly in component code — can be changed without a deploy. The map is cached
 * in localStorage and applied before the first render to avoid a flash of the old wording.
 */
import { api } from "../services/api";

const CACHE_KEY = "skill_dna_site_texts";
const ATTRS = ["placeholder", "title", "aria-label"] as const;
const IGNORE = "[data-cms-ignore], script, style, textarea, code, pre";

const overrides = new Map<string, string>(); // normalised source -> replacement
const originalOfText = new WeakMap<Text, string>(); // text node currently showing a replacement -> its source
const originalOfAttr = new WeakMap<Element, Record<string, string>>();
const listeners = new Set<() => void>();
let observer: MutationObserver | null = null;

export const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

const ignored = (el: Element | null) => !el || !!el.closest(IGNORE);

function applyText(node: Text) {
  const raw = node.nodeValue;
  if (!raw || !raw.trim() || ignored(node.parentElement)) return;
  const shown = normalize(raw);
  const source = originalOfText.get(node);
  if (source !== undefined) {
    const replacement = overrides.get(source);
    if (replacement !== undefined && shown === normalize(replacement)) return; // already ours
    if (replacement === undefined && shown === source) {
      originalOfText.delete(node);
      return;
    }
    if (shown !== source) originalOfText.delete(node); // React rendered new text: treat it as a fresh source
  }
  const key = originalOfText.get(node) ?? shown;
  const replacement = overrides.get(key);
  if (replacement === undefined) return;
  originalOfText.set(node, key);
  const lead = raw.match(/^\s*/)![0];
  const trail = raw.match(/\s*$/)![0];
  const next = lead + replacement + trail;
  if (node.nodeValue !== next) node.nodeValue = next;
}

function applyAttrs(el: Element) {
  if (ignored(el)) return;
  for (const attr of ATTRS) {
    const raw = el.getAttribute(attr);
    if (raw === null) continue;
    const saved = originalOfAttr.get(el) ?? {};
    const shown = normalize(raw);
    const known = saved[attr];
    if (known !== undefined && overrides.get(known) !== undefined && shown === normalize(overrides.get(known)!)) continue;
    const key = known !== undefined && (shown === known || shown === normalize(overrides.get(known) ?? "")) ? known : shown;
    const replacement = overrides.get(key);
    if (replacement === undefined) {
      if (known !== undefined && shown !== known) el.setAttribute(attr, known); // override removed
      continue;
    }
    saved[attr] = key;
    originalOfAttr.set(el, saved);
    if (raw !== replacement) el.setAttribute(attr, replacement);
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    applyText(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) applyAttrs(root as Element);
  const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = it.nextNode(); n; n = it.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) applyText(n as Text);
    else applyAttrs(n as Element);
  }
}

/** Restores nodes whose override was removed, then applies the current map everywhere. */
function reapplyAll() {
  const it = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = it.nextNode(); n; n = it.nextNode()) {
    const t = n as Text;
    const source = originalOfText.get(t);
    if (source !== undefined && !overrides.has(source)) {
      t.nodeValue = source;
      originalOfText.delete(t);
    }
  }
  walk(document.body);
  listeners.forEach((fn) => fn());
}

function setAll(items: { source: string; value: string }[]) {
  overrides.clear();
  for (const { source, value } of items) overrides.set(normalize(source), value);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(items));
  } catch {}
}

function persist() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify([...overrides].map(([source, value]) => ({ source, value }))));
  } catch {}
}

/** Starts the engine: cached overrides immediately, fresh ones from the server right after. */
export function initSiteTexts() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "[]");
    if (Array.isArray(cached)) for (const { source, value } of cached) overrides.set(normalize(source), value);
  } catch {}
  observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "characterData") applyText(r.target as Text);
      else if (r.type === "attributes") applyAttrs(r.target as Element);
      else r.addedNodes.forEach(walk);
    }
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS],
  });
  walk(document.body);
  refreshSiteTexts();
}

export function refreshSiteTexts() {
  return api
    .getSiteContent()
    .then((data) => {
      setAll(data.items);
      reapplyAll();
    })
    .catch(() => {});
}

/** The wording a node had before any override (what the CMS stores as `source`). */
export function originalText(node: Text): string {
  return originalOfText.get(node) ?? normalize(node.nodeValue || "");
}

export function currentOverride(source: string): string | undefined {
  return overrides.get(normalize(source));
}

export function setLocalOverride(source: string, value: string) {
  overrides.set(normalize(source), value);
  persist();
  reapplyAll();
}

export function removeLocalOverride(source: string) {
  overrides.delete(normalize(source));
  persist();
  reapplyAll();
}

export function onSiteTextsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
