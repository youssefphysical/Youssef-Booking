// =============================
// Device fingerprint (best-effort, abuse-prevention only)
// =============================
// Lightweight stable-ish hash of low-entropy browser signals + a per-
// browser random salt persisted in localStorage. NOT a security
// primitive — used solely to detect a single person spinning up many
// accounts to re-claim the free trial. A motivated user can clear
// storage and dodge it; that's acceptable given the layered checks
// (normalised email/phone + hasUsedFreeTrial flag).

const SALT_KEY = "youssef.dfp.salt";

function getOrCreateSalt(): string {
  if (typeof window === "undefined") return "";
  try {
    let salt = localStorage.getItem(SALT_KEY);
    if (!salt) {
      const arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      salt = Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(SALT_KEY, salt);
    }
    return salt;
  } catch {
    return "";
  }
}

async function sha256Hex(input: string): Promise<string> {
  if (typeof window === "undefined" || !window.crypto?.subtle) return "";
  const bytes = new TextEncoder().encode(input);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getDeviceFingerprint(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const salt = getOrCreateSalt();
    const nav = window.navigator;
    const scr = window.screen;
    const parts = [
      salt,
      nav.userAgent,
      nav.language,
      String(nav.hardwareConcurrency ?? ""),
      String((nav as any).deviceMemory ?? ""),
      `${scr.width}x${scr.height}x${scr.colorDepth}`,
      String(new Date().getTimezoneOffset()),
    ];
    const hex = await sha256Hex(parts.join("|"));
    return hex || null;
  } catch {
    return null;
  }
}
