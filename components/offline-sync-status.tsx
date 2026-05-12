"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import { apiFetch } from "@/lib/api-config";
import {
  getQueuedProductCreateCount,
  replayQueuedProductCreates,
  subscribeToOfflineQueue,
  useOnlineStatus,
} from "@/lib/offline";
import { useLanguage } from "@/lib/LanguageContext";

export function OfflineSyncStatus() {
  const isOnline = useOnlineStatus();
  const { text } = useLanguage();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPendingCount = useCallback(() => {
    setPendingCount(getQueuedProductCreateCount());
  }, []);

  const runSync = useCallback(async () => {
    if (!navigator.onLine || syncing || getQueuedProductCreateCount() === 0) {
      refreshPendingCount();
      return;
    }

    setSyncing(true);
    try {
      await replayQueuedProductCreates((entry) =>
        apiFetch(`/products/?farmer_id=${entry.farmerId}`, {
          method: "POST",
          body: JSON.stringify(entry.payload),
        }),
      );
    } finally {
      setSyncing(false);
      refreshPendingCount();
    }
  }, [refreshPendingCount, syncing]);

  useEffect(() => {
    refreshPendingCount();
    return subscribeToOfflineQueue(refreshPendingCount);
  }, [refreshPendingCount]);

  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      void runSync();
    }
  }, [isOnline, pendingCount, runSync]);

  // Only show this component if we are actually syncing or have items to sync.
  // The general "Offline" message is now handled by ConnectionStatus.
  if (!syncing && pendingCount === 0) {
    return null;
  }

  const message = !isOnline
    ? `${text.offlineBannerOffline}${pendingCount > 0 ? ` · ${text.offlineBannerPending.replace("{count}", String(pendingCount))}` : ""}`
    : syncing
      ? text.offlineBannerSyncing
      : text.offlineBannerPending.replace("{count}", String(pendingCount));

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-foreground shadow-lg">
      {!isOnline ? <WifiOff className="h-4 w-4 text-primary" /> : <RefreshCw className="h-4 w-4 animate-spin text-primary" />}
      <span>{message}</span>
    </div>
  );
}