"use client";

import { useEffect, useState } from "react";

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
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
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