"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications } from "@/hooks/use-notifications";
import { mutate } from "swr";
import { keys } from "@/lib/swr-keys";
import { UserAvatar } from "@/components/ui/UserAvatar";

interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  body: string;
  groupId?: string;
  amount?: number;
  currency?: string;
  actorName?: string;
  read: boolean;
  createdAt: string;
}

const TYPE_ICON: Record<string, string> = {
  expense_added:        "💸",
  expense_edited:       "✏️",
  expense_deleted:      "🗑️",
  settlement_made:      "💰",
  settlement_confirmed: "✅",
  settlement_disputed:  "⚠️",
  member_joined:        "👋",
  guest_joined:         "🔗",
  invite_expiring:      "⏰",
  debt_reminder:        "🔔",
  group_created:        "🎉",
};

function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function NotificationBell() {
  // SWR for initial data and polling fallback
  const { notifications: swrNotifications, unreadCount: swrUnreadCount, mutate: mutateNotifications } = useNotifications();

  // Local state for real-time updates (SSE)
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [open,          setOpen]          = useState(false);
  const [connected,     setConnected]     = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const pushRequestedRef = useRef(false);
  const isSsrInitialized = useRef(false);

  // Sync SWR data to local state on initial load
  useEffect(() => {
    if (!isSsrInitialized.current && swrNotifications.length > 0) {
      setNotifications(swrNotifications);
      setUnreadCount(swrUnreadCount);
      isSsrInitialized.current = true;
    }
  }, [swrNotifications, swrUnreadCount]);

  // ── SSE connection for real-time updates ─────────────────────────────────
  useEffect(() => {
    // Connect to SSE stream
    const es = new EventSource("/api/notifications/stream");
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type === "init") {
          setUnreadCount(payload.unreadCount ?? 0);
        }

        if (payload.type === "notification") {
          const n: NotificationItem = payload.notification;

          // Update local state for immediate UI feedback
          setNotifications((prev) => [n, ...prev.slice(0, 49)]);
          setUnreadCount((prev) => prev + 1);

          // Optimistically update SWR cache
          mutateNotifications(
            (current: any) => ({
              notifications: [n, ...(current?.notifications ?? [])].slice(0, 50),
              count: (current?.count ?? 0) + 1,
            }),
            { revalidate: false }
          );

          // Browser notification when tab is in background
          if (
            document.visibilityState === "hidden" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            new Notification(n.title, {
              body:  n.body,
              icon:  "/icon-192.png",
              badge: "/icon-192.png",
              tag:   n._id,
            });
          }
        }
      } catch (err) {
        console.error("[SSE] Parse error:", err);
      }
    };

    es.onerror = () => {
      setConnected(false);
      // EventSource reconnects automatically — no manual action needed
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [mutateNotifications]);

  // ── Mark all read when panel opens ───────────────────────────────────────
  const handleOpen = async (isOpen: boolean) => {
    setOpen(isOpen);

    if (isOpen && unreadCount > 0) {
      // Request push permission on first bell interaction
      if (!pushRequestedRef.current) {
        pushRequestedRef.current = true;
        requestPushPermission();
      }
    }

    if (!isOpen && unreadCount > 0) {
      // Mark all as read when panel closes
      await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      }).catch(() => {});

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);

      // Update SWR cache
      mutateNotifications(
        (current: any) => ({
          ...current,
          count: 0,
          notifications: current?.notifications?.map((n: NotificationItem) => ({ ...n, read: true })) ?? [],
        }),
        { revalidate: false }
      );
    }
  };

  const markOneRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    }).catch(() => {});

    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    // Update SWR cache
    mutateNotifications(
      (current: any) => ({
        ...current,
        count: Math.max(0, (current?.count ?? 0) - 1),
        notifications: current?.notifications?.map((n: NotificationItem) =>
          n._id === id ? { ...n, read: true } : n
        ) ?? [],
      }),
      { revalidate: false }
    );
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger className="relative p-2 text-slate-400 hover:text-slate-200 hover:bg-[#1E293B] rounded-lg transition-all min-w-11 min-h-11 flex items-center justify-center">
        <Bell className="w-5 h-5" />
        {/* Connection dot */}
        <span
          className={`absolute bottom-1.5 right-1.5 size-1.5 rounded-full ${
            connected ? "bg-emerald-400" : "bg-slate-600"
          }`}
          aria-hidden="true"
        />
        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 sm:w-96 bg-[#0F172A] border-[#1E293B] p-0 max-h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E293B] shrink-0">
          <h3 className="text-sm font-semibold text-slate-200">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={() => handleOpen(false)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-400 transition-colors"
            >
              <CheckCheck className="size-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="size-8 text-slate-700 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n._id}
                onClick={() => !n.read && markOneRead(n._id)}
                className={`flex items-start gap-3 px-4 py-3 border-b border-[#1E293B]/60 hover:bg-[#1E293B]/40 transition-colors cursor-pointer ${
                  !n.read ? "bg-[#10B981]/5" : ""
                }`}
              >
                {/* Unread dot */}
                <div className="mt-1 shrink-0">
                  <span
                    className={`block size-2 rounded-full ${
                      !n.read ? "bg-emerald-400" : "bg-transparent"
                    }`}
                  />
                </div>

                {/* Icon / Actor avatar */}
                <div className="shrink-0 mt-0.5">
                  {n.actorName ? (
                    <UserAvatar name={n.actorName} size={24} />
                  ) : (
                    <span className="text-base" aria-hidden="true">
                      {TYPE_ICON[n.type] ?? "🔔"}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 leading-snug">
                    {n.title}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
                    {n.body}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-slate-600">
                      {timeAgo(n.createdAt)}
                    </span>
                    {n.groupId && (
                      <a
                        href={`/groups/${n.groupId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-0.5 text-[11px] text-emerald-500 hover:text-emerald-400"
                      >
                        <ExternalLink className="size-2.5" />
                        View
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-4 py-2.5 border-t border-[#1E293B] shrink-0">
            <a
              href="/settlements"
              className="text-xs text-slate-500 hover:text-emerald-400 transition-colors"
            >
              View all settlements →
            </a>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Web Push permission helper ────────────────────────────────────────────────

async function requestPushPermission(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const reg = await navigator.serviceWorker.register("/sw.js");
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      ) as unknown as BufferSource,
    });

    await fetch("/api/user/push-subscription", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
  } catch (err) {
    console.error("[push] Registration failed:", err);
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
