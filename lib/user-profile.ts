"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, redirectToLoginIfUnauthorized, type AppSession } from "@/lib/api-config";
import { getDisplayErrorMessage } from "@/lib/offline";

export interface UserProfile {
    id: number;
    phone_number: string;
    role: string;
    name: string;
    province?: string | null;
    address?: string | null;
    commune?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    balance?: number;
    is_active?: boolean;
}

export function getUserInitials(name?: string | null, fallback = "--") {
    if (!name?.trim()) return fallback;
    return name
        .trim()
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

export function formatUserLocation(user?: Partial<UserProfile> | null) {
    const formatted = [user?.address, user?.commune, user?.province]
        .filter((value): value is string => Boolean(value?.trim()))
        .join(", ");

    return formatted || user?.province || "Localisation non renseignée";
}

export function formatUserCoordinates(user?: Partial<UserProfile> | null) {
    if (user?.latitude == null || user?.longitude == null) {
        return "Coordonnées non renseignées";
    }

    return `${user.latitude.toFixed(5)}, ${user.longitude.toFixed(5)}`;
}

export function useSessionUserProfile(session?: AppSession | null, ready = true) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        if (!session) {
            setUser(null);
            setLoading(false);
            return null;
        }

        setLoading(true);
        try {
            const profile = await apiFetch(`/users/${session.userId}`, { cache: "no-store" }) as UserProfile;
            setUser(profile);
            setError(null);
            return profile;
        } catch (err: unknown) {
            if (redirectToLoginIfUnauthorized(err, session?.role)) {
                setUser(null);
                setError(null);
                return null;
            }

            setError(getDisplayErrorMessage(err, "Impossible de charger le profil utilisateur."));
            return null;
        } finally {
            setLoading(false);
        }
    }, [session?.role, session?.userId]);

    useEffect(() => {
        if (!ready || !session) {
            setUser(null);
            setError(null);
            setLoading(false);
            return;
        }

        void reload();
    }, [ready, reload, session]);

    return { user, setUser, loading, error, reload };
}