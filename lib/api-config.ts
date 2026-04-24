// En local, on utilise localhost pour que les cookies de session (auth) fonctionnent (même origine).
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const ROLE_ALIASES = {
    acheteur: "acheteur",
    buyer: "acheteur",
    fermier: "fermier",
    farmer: "fermier",
    logistique: "logistique",
    driver: "logistique",
    admin: "admin",
} as const;

export type CanonicalRole = "acheteur" | "fermier" | "logistique" | "admin";
const SESSION_SNAPSHOT_STORAGE_KEY = "agriconnect_session_snapshot"; 
const SESSION_SNAPSHOT_VERSION = 1;

export interface AppSession {
    userId: number;
    role: CanonicalRole;
}

type SessionPayloadLike = {
    userId?: unknown;
    user_id?: unknown;
    role?: unknown;
};

interface StoredSessionSnapshot {
    version: number;
    session: AppSession;
    savedAt: string;
}

export class ApiError extends Error {
    status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        Object.setPrototypeOf(this, ApiError.prototype);
    }
}

export function buildApiUrl(endpoint: string) {
    return endpoint.startsWith("http")
        ? endpoint
        : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
}

export function buildImageUrl(imageUrl?: string | null) {
    if (!imageUrl) return null;
    return imageUrl.startsWith("http") ? imageUrl : buildApiUrl(imageUrl);
}

export function normalizeRole(role?: string | null): CanonicalRole | null {
    if (!role) return null;
    const normalized = role.trim().toLowerCase();
    return ROLE_ALIASES[normalized as keyof typeof ROLE_ALIASES] ?? null;
}

function isBrowser() {
    return typeof window !== "undefined";
}

export function parseAppSession(payload: unknown): AppSession | null {
    if (!payload || typeof payload !== "object") return null;

    const candidate = payload as SessionPayloadLike;
    const parsedUserId = Number(candidate.userId ?? candidate.user_id);
    const normalizedRole = typeof candidate.role === "string" ? normalizeRole(candidate.role) : null;

    if (!Number.isFinite(parsedUserId) || parsedUserId <= 0 || !normalizedRole) {
        return null;
    }

    return {
        userId: parsedUserId,
        role: normalizedRole,
    };
}

function isValidAppSession(value: unknown): value is AppSession {
    return parseAppSession(value) !== null;
}

export function loadSessionSnapshot(): AppSession | null {
    if (!isBrowser()) return null;

    try {
        const raw = window.localStorage.getItem(SESSION_SNAPSHOT_STORAGE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as StoredSessionSnapshot | AppSession;
        const snapshot = isValidAppSession(parsed)
            ? parsed
            : parsed && typeof parsed === "object"
                ? (parsed as StoredSessionSnapshot).session
                : null;

        if (!isValidAppSession(snapshot)) return null;

        return parseAppSession(snapshot);
    } catch {
        return null;
    }
}

export function persistSessionSnapshot(session: AppSession) {
    if (!isBrowser() || !isValidAppSession(session)) return;

    try {
        const payload: StoredSessionSnapshot = {
            version: SESSION_SNAPSHOT_VERSION,
            session,
            savedAt: new Date().toISOString(),
        };
        window.localStorage.setItem(SESSION_SNAPSHOT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // Ignore storage failures in privacy/quota-constrained environments.
    }
}

export function clearSessionSnapshot() {
    if (!isBrowser()) return;

    try {
        window.localStorage.removeItem(SESSION_SNAPSHOT_STORAGE_KEY);
    } catch {
        // Ignore storage failures.
    }
}

export function getApiErrorStatus(error: unknown) {
    if (error instanceof ApiError && typeof error.status === "number") {
        return error.status;
    }

    if (error && typeof error === "object") {
        const status = (error as { status?: unknown }).status;
        if (typeof status === "number") {
            return status;
        }
    }

    return null;
}

export function redirectToLoginIfUnauthorized(error: unknown, fallbackRole?: string | null) {
    if (!isBrowser()) return false;

    const status = getApiErrorStatus(error);
    if (status !== 401 && status !== 403) {
        return false;
    }

    const snapshot = loadSessionSnapshot();
    const role = normalizeRole(fallbackRole) ?? snapshot?.role ?? null;
    const loginPath = getLoginPath(role);

    clearSessionSnapshot();

    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (currentPath !== loginPath) {
        window.location.replace(loginPath);
    }

    return true;
}

export function getRoleLabel(role?: string | null, lang: "fr" | "ki" = "fr") {
    switch (normalizeRole(role)) {
        case "fermier":
            return lang === "ki" ? "Umurimyi" : "Fermier";
        case "logistique":
            return lang === "ki" ? "Umushikiriza" : "Livreur";
        case "admin":
            return "Admin";
        case "acheteur":
        default:
            return lang === "ki" ? "Umuguzi" : "Acheteur";
    }
}

export function getRoleHomePath(role?: string | null) {
    switch (normalizeRole(role)) {
        case "fermier":
            return "/fermier";
        case "acheteur":
            return "/acheteur";
        case "logistique":
            return "/logistique";
        case "admin":
            return "/admin";
        default:
            return "/";
    }
}

export function getLoginPath(role?: string | null) {
    const normalizedRole = normalizeRole(role) ?? "acheteur";
    return `/connexion?role=${normalizedRole}`;
}

export function getSignupPath(role?: string | null) {
    const normalizedRole = normalizeRole(role) ?? "acheteur";
    return `/inscription?role=${normalizedRole}`;
}

export function hasRequiredRole(session: AppSession | null, allowedRoles?: string | string[]) {
    if (!session) return false;

    const roles = (Array.isArray(allowedRoles) ? allowedRoles : allowedRoles ? [allowedRoles] : [])
        .map((role) => normalizeRole(role))
        .filter(Boolean) as CanonicalRole[];

    return roles.length === 0 || roles.includes(session.role);
}

export async function fetchCurrentSession(): Promise<AppSession> {
    const payload = await apiFetch("/auth/me", {
        cache: "no-store",
    }) as { user_id: number | string; role: string };

    const session = parseAppSession(payload);

    if (!session) {
        throw new Error("Session invalide reçue du serveur");
    }

    persistSessionSnapshot(session);
    return session;
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const url = buildApiUrl(endpoint);
    const headers = new Headers(options.headers ?? {});
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

    if (!isFormData && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    let response: Response;

    try {
        response = await fetch(url, {
            ...options,
            credentials: options.credentials ?? "include",
            headers,
        });
    } catch (error) {
        const message = error instanceof Error && error.message
            ? error.message
            : "Impossible de joindre le serveur";
        throw new ApiError(message, 0);
    }

    if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        const errorPayload = contentType.includes("application/json")
            ? await response.json().catch(() => ({ detail: "Erreur serveur" }))
            : { detail: await response.text().catch(() => "Erreur serveur") };

        throw new ApiError(errorPayload.detail || `HTTP error! status: ${response.status}`, response.status);
    }

    if (response.status === 204) return null;

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
        return response.json();
    }

    return response.text();
}
