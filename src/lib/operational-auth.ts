import { supabase } from "@/integrations/supabase/client";

export type OperationalRole = "admin" | "vendor" | "cyclist";

export const ADMIN_PHONE = "+212605377941";
export const ADMIN_SESSION_STORAGE_KEY = "bzaf.adminSession";
export const VENDOR_SESSION_STORAGE_KEY = "bzaf.vendorSession";
export const CYCLIST_SESSION_STORAGE_KEY = "bzaf.cyclistSession";

type RoleSession = {
  role: OperationalRole;
  phoneNumber: string;
};

type AccessResult = {
  allowed: boolean;
  redirectTo: string | null;
};

export async function ensureAuthSessionHydrated() {
  try {
    await supabase.auth.getSession();
  } catch {
    // no-op: operational OTP sessions are checked separately.
  }
}

export function subscribeToAuthChanges(onChange: () => void) {
  const { data } = supabase.auth.onAuthStateChange(() => {
    onChange();
  });

  return data.subscription;
}

export function persistRoleSession(role: OperationalRole, payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  clearRoleSessions();

  const entry = JSON.stringify(payload);
  if (role === "admin") {
    window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, entry);
    return;
  }

  if (role === "vendor") {
    window.localStorage.setItem(VENDOR_SESSION_STORAGE_KEY, entry);
    return;
  }

  window.localStorage.setItem(CYCLIST_SESSION_STORAGE_KEY, entry);
}

export function clearRoleSessions() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  window.localStorage.removeItem(VENDOR_SESSION_STORAGE_KEY);
  window.localStorage.removeItem(CYCLIST_SESSION_STORAGE_KEY);
}

export function evaluateOperationalAccess(pathname: string): AccessResult {
  if (typeof window === "undefined") {
    return { allowed: true, redirectTo: null };
  }

  const roleSession = getCurrentRoleSession();

  if (pathname.startsWith("/admin")) {
    if (!roleSession) return { allowed: false, redirectTo: "/staff-portal" };
    if (roleSession.role !== "admin") return { allowed: false, redirectTo: roleHome(roleSession.role) };
    if (roleSession.phoneNumber !== ADMIN_PHONE) {
      clearRoleSessions();
      return { allowed: false, redirectTo: "/staff-portal" };
    }
    return { allowed: true, redirectTo: null };
  }

  if (pathname.startsWith("/vendor")) {
    if (pathname === "/vendor/login") return { allowed: true, redirectTo: null };
    if (!roleSession) return { allowed: false, redirectTo: "/staff-portal" };
    if (roleSession.role !== "vendor") return { allowed: false, redirectTo: roleHome(roleSession.role) };
    return { allowed: true, redirectTo: null };
  }

  if (pathname.startsWith("/cyclist")) {
    if (pathname === "/cyclist/login") return { allowed: true, redirectTo: null };
    if (!roleSession) return { allowed: false, redirectTo: "/staff-portal" };
    if (roleSession.role !== "cyclist") return { allowed: false, redirectTo: roleHome(roleSession.role) };
    return { allowed: true, redirectTo: null };
  }

  return { allowed: true, redirectTo: null };
}

function getCurrentRoleSession(): RoleSession | null {
  const admin = parseSession(ADMIN_SESSION_STORAGE_KEY) as { phoneNumber?: string } | null;
  if (admin?.phoneNumber) {
    return { role: "admin", phoneNumber: admin.phoneNumber };
  }

  const vendor = parseSession(VENDOR_SESSION_STORAGE_KEY) as { phoneNumber?: string } | null;
  if (vendor?.phoneNumber) {
    return { role: "vendor", phoneNumber: vendor.phoneNumber };
  }

  const cyclist = parseSession(CYCLIST_SESSION_STORAGE_KEY) as { phoneNumber?: string } | null;
  if (cyclist?.phoneNumber) {
    return { role: "cyclist", phoneNumber: cyclist.phoneNumber };
  }

  return null;
}

function parseSession(key: string) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function roleHome(role: OperationalRole) {
  if (role === "admin") return "/admin";
  if (role === "vendor") return "/vendor/dashboard";
  return "/cyclist/dashboard";
}