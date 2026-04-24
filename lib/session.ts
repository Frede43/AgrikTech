"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    type AppSession,
    type CanonicalRole,
    clearSessionSnapshot,
    fetchCurrentSession,
    getApiErrorStatus,
    getLoginPath,
    hasRequiredRole,
    loadSessionSnapshot,
    normalizeRole,
} from "@/lib/api-config";

type AllowedRoles = CanonicalRole | string | Array<CanonicalRole | string>;

export function useRequiredSession(allowedRoles?: AllowedRoles) {
    const router = useRouter();
    const [session, setSession] = useState<AppSession | null>(null);
    const [ready, setReady] = useState(false);
    const [source, setSource] = useState<"live" | "cached" | null>(null);
    const roleKey = Array.isArray(allowedRoles) ? allowedRoles.join("|") : allowedRoles ?? "";

    useEffect(() => {
        const normalizedRoles = (Array.isArray(allowedRoles) ? allowedRoles : allowedRoles ? [allowedRoles] : [])
            .map((role) => normalizeRole(role))
            .filter(Boolean) as CanonicalRole[];

        let cancelled = false;

        const loadSession = async () => {
            const cachedSession = loadSessionSnapshot();

            try {
                const currentSession = await fetchCurrentSession();
                if (!hasRequiredRole(currentSession, normalizedRoles)) {
                    throw new Error("Rôle de session invalide");
                }
                if (cancelled) return;
                setSession(currentSession);
                setSource("live");
            } catch (error) {
                if (cancelled) return;

                const status = getApiErrorStatus(error);
                if (status === 401 || status === 403) {
                    clearSessionSnapshot();
                    setSession(null);
                    setSource(null);
                    router.replace(getLoginPath(normalizedRoles[0]));
                    return;
                }

                if (cachedSession && hasRequiredRole(cachedSession, normalizedRoles)) {
                    setSession(cachedSession);
                    setSource("cached");
                    return;
                }

                setSession(null);
                setSource(null);
                router.replace(getLoginPath(normalizedRoles[0]));
            } finally {
                if (!cancelled) {
                    setReady(true);
                }
            }
        };

        loadSession();

        return () => {
            cancelled = true;
        };
    }, [router, roleKey]);

    return { session, ready, source, isOfflineFallback: source === "cached" };
}

export function useSession() {
    const [session, setSession] = useState<AppSession | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const s = await fetchCurrentSession();
                if (!cancelled) setSession(s);
            } catch (err) {
                const cached = loadSessionSnapshot();
                if (!cancelled) setSession(cached || null);
            } finally {
                if (!cancelled) setReady(true);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    return { session, ready };
}