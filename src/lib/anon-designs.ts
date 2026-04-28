// localStorage-backed gallery for anonymous users.
// Lets people create a few designs before they're forced to sign in,
// without losing their work to a refresh or accidental tab close.

export const MAX_FREE_GENERATIONS = 3;
const STORAGE_KEY = "gh:anon:designs";

export interface AnonDesign {
  localId: string;
  prompt: string;
  style: string;
  imageUrl: string;
  createdAt: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getAnonDesigns(): AnonDesign[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (d): d is AnonDesign =>
        d && typeof d.localId === "string" && typeof d.imageUrl === "string",
    );
  } catch {
    return [];
  }
}

export function addAnonDesign(d: Omit<AnonDesign, "localId" | "createdAt">): AnonDesign {
  const entry: AnonDesign = {
    ...d,
    localId: `anon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const existing = getAnonDesigns();
  const next = [entry, ...existing].slice(0, MAX_FREE_GENERATIONS);
  if (isBrowser()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return entry;
}

export function clearAnonDesigns(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function getRemainingFreeGenerations(): number {
  return Math.max(0, MAX_FREE_GENERATIONS - getAnonDesigns().length);
}
