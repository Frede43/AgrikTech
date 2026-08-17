"use client";

import { useEffect, useState } from "react";
import { buildApiUrl } from "./api-config";

const STORAGE_KEYS = {
  productQueue: "agriconnect-offline-product-queue",
  cataloguePrefix: "agriconnect-offline-catalogue",
};

const QUEUE_UPDATED_EVENT = "agriconnect-offline-queue-updated";

export interface CatalogueCache<TProduct = unknown, TCategory = unknown> {
  products: TProduct[];
  categories: TCategory[];
  savedAt: string;
}

export interface QueuedProductCreatePayload {
  name: string;
  category: string;
  price_per_kg: number;
  unit: string;
  quantity_kg: number;
  province: string;
}

export interface QueuedProductCreateItem {
  id: string;
  farmerId: number;
  payload: QueuedProductCreatePayload;
  createdAt: string;
  imageDeferred: boolean;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function readJsonStorage<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key: string, value: unknown) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore local storage quota or privacy mode failures.
  }
}

function emitQueueUpdated() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(QUEUE_UPDATED_EVENT));
}

export function useOnlineStatus() {
  // Toujours "true" au premier rendu, y compris côté client : Node.js expose
  // un global `navigator` (sans `.onLine`, qui vaut alors `undefined`), donc
  // `typeof navigator === "undefined"` est FAUX côté serveur — l'ancien code
  // y lisait `navigator.onLine` (undefined, donc "hors ligne") pendant que le
  // navigateur, lui, rendait `true` dès le premier rendu client : un vrai
  // écart de contenu entre le HTML serveur et l'hydratation React. Le vrai
  // statut réseau est de toute façon vérifié juste après via l'effet
  // ci-dessous (ping réel sur /api/health), donc la valeur initiale n'a
  // besoin d'être exacte que le temps de ce premier check.
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    const checkStatus = async () => {
      if (!navigator.onLine) {
        if (!cancelled) setIsOnline(false);
        return;
      }

      // Si le navigateur dit "online", on vérifie réellement avec un ping léger sur l'API
      try {
        const response = await fetch(buildApiUrl("/api/health"), {
          method: "HEAD",
          cache: "no-store",
          // On évite d'envoyer les cookies pour un simple ping réseau
          credentials: "omit"
        }).catch(() => ({ ok: false }));
        if (!cancelled) setIsOnline(response.ok);
      } catch {
        if (!cancelled) setIsOnline(false);
      }
    };

    // Vérifie la connectivité réelle dès le montage : navigator.onLine peut
    // renvoyer un faux "offline" transitoire (fréquent sur réseaux mobiles
    // instables), sans quoi le bandeau restait bloqué indéfiniment.
    void checkStatus();

    const handleOnline = () => {
      // Attendre un court instant pour laisser le réseau se stabiliser
      setTimeout(checkStatus, 1000);
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Vérification périodique toutes les 30 secondes (détecte aussi bien le
    // retour en ligne qu'une panne backend survenue en cours de session).
    const interval = setInterval(checkStatus, 30000);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  return isOnline;
}

export function isLikelyNetworkError(error: unknown) {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (status === 0) return true;
  }

  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /failed to fetch|networkerror|load failed|network request|impossible de joindre le serveur/i.test(message);
}

export function logIfNotNetworkError(message: string, error: unknown, method: "error" | "warn" = "error") {
  if (isLikelyNetworkError(error)) return;

  if (method === "warn") {
    console.warn(message, error);
    return;
  }

  console.error(message, error);
}

export function getDisplayErrorMessage(error: unknown, fallback: string) {
  if (isLikelyNetworkError(error)) return fallback;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function getCatalogueCacheKey(scope: string) {
  return `${STORAGE_KEYS.cataloguePrefix}:${scope}`;
}

export function loadCachedCatalogue<TProduct = unknown, TCategory = unknown>(scope: string) {
  return readJsonStorage<CatalogueCache<TProduct, TCategory> | null>(getCatalogueCacheKey(scope), null);
}

export function saveCachedCatalogue<TProduct = unknown, TCategory = unknown>(scope: string, cache: CatalogueCache<TProduct, TCategory>) {
  writeJsonStorage(getCatalogueCacheKey(scope), cache);
}

export function getQueuedProductCreates() {
  return readJsonStorage<QueuedProductCreateItem[]>(STORAGE_KEYS.productQueue, []);
}

export function getQueuedProductCreateCount() {
  return getQueuedProductCreates().length;
}

export function queueProductCreate(input: Omit<QueuedProductCreateItem, "id" | "createdAt">) {
  const queue = getQueuedProductCreates();
  const queuedItem: QueuedProductCreateItem = {
    ...input,
    id: `queued-product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };

  writeJsonStorage(STORAGE_KEYS.productQueue, [...queue, queuedItem]);
  emitQueueUpdated();
  return queuedItem;
}

export async function replayQueuedProductCreates(
  submitter: (entry: QueuedProductCreateItem) => Promise<unknown>,
) {
  const queue = getQueuedProductCreates();
  if (!queue.length) {
    return { synced: 0, remaining: 0, stoppedByNetwork: false };
  }

  const remaining: QueuedProductCreateItem[] = [];
  let synced = 0;
  let stoppedByNetwork = false;

  for (let index = 0; index < queue.length; index += 1) {
    const entry = queue[index];

    try {
      await submitter(entry);
      synced += 1;
    } catch (error) {
      remaining.push(entry);
      if (isLikelyNetworkError(error)) {
        remaining.push(...queue.slice(index + 1));
        stoppedByNetwork = true;
        break;
      }
    }
  }

  writeJsonStorage(STORAGE_KEYS.productQueue, remaining);
  emitQueueUpdated();

  return { synced, remaining: remaining.length, stoppedByNetwork };
}

export function subscribeToOfflineQueue(listener: () => void) {
  if (!isBrowser()) return () => undefined;

  window.addEventListener(QUEUE_UPDATED_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(QUEUE_UPDATED_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}