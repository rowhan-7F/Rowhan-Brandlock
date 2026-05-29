"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, Check, FileText, MessageSquare, CheckCircle2, XCircle,
  Loader2, Inbox,
} from "lucide-react";
import { supabase } from "../lib/supabase";

// ============================================================
//  NOTIFICATION BELL — routage intelligent selon rôle
// ============================================================

type Notification = {
  id: string;
  type:
    | "task_assigned"
    | "task_completed"
    | "project_submitted"
    | "project_approved"
    | "project_rejected"
    | "comment_added"
    | "role_delegated";
  title: string;
  message: string | null;
  related_project_id: string | null;
  related_task_id: string | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsBell({ brandColor = "#F26522" }: { brandColor?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userRole, setUserRole] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ⭐ Charge le rôle de l'user pour router correctement
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (profile?.role) {
        setUserRole(profile.role);
        console.log("[BELL] user role:", profile.role);
      }
    })();
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/notifications?limit=20", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        if (res.status !== 401) console.warn("[BELL] Fetch failed:", res.status);
        return;
      }

      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      console.error("[BELL] Fatal error:", err);
    }
  }, []);

  // Auto-refresh toutes les 30s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Refresh quand on ouvre
  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchNotifications().finally(() => setLoading(false));
    }
  }, [open, fetchNotifications]);

  // Fermer si click extérieur
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // ============================================================
  //  ⭐ ROUTAGE INTELLIGENT SELON RÔLE + TYPE DE NOTIF
  // ============================================================
  // ============================================================
  //  ⭐ ROUTAGE INTELLIGENT SELON RÔLE + TYPE PROJET (carousel/video)
  // ============================================================
  const getRouteForNotification = async (notif: Notification): Promise<string> => {
    console.log("[BELL] === START getRouteForNotification ===", { notifId: notif.id, type: notif.type, related_project_id: notif.related_project_id, userRole });
    // Si la notif a un project_id → on doit detecter si c'est carousel ou video
    if (notif.related_project_id) {
      // Detecter le type : query studio_video_projects
      let isVideo = false;
      console.log("[BELL] Query studio_video_projects with id:", notif.related_project_id);
      try {
        const { data: videoProject } = await supabase
          .from("studio_video_projects")
          .select("id")
          .eq("id", notif.related_project_id)
          .maybeSingle();
        isVideo = !!videoProject;
        console.log("[BELL] Query result:", { videoProject, isVideo: !!videoProject });
      } catch (err) {
        console.warn("[BELL] type detection error:", err);
      }

      // Routing selon role + type
      if (userRole === "tenant_admin" || userRole === "super_admin") {
        return isVideo
          ? `/admin/tenant/projects/video/${notif.related_project_id}`
          : `/admin/tenant/projects/${notif.related_project_id}`;
      }
      // Graphiste
      return isVideo
        ? `/studio/video/${notif.related_project_id}`
        : `/studio/${notif.related_project_id}`;
    }

    // Si la notif a un task_id → dépend du rôle
    if (notif.related_task_id) {
      if (userRole === "tenant_admin" || userRole === "super_admin") {
        return "/admin/tenant";
      }
      return "/studio";
    }

    // Fallback : dashboard correspondant au role
    if (userRole === "tenant_admin" || userRole === "super_admin") {
      return "/admin/tenant";
    }
    return "/studio";
  };

  const handleNotifClick = async (notif: Notification) => {
    if (!notif.is_read) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ id: notif.id }),
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        console.error("[BELL] Mark read error:", err);
      }
    }

    setOpen(false);
    const targetRoute = await getRouteForNotification(notif);
    console.log("[BELL] Routing to:", targetRoute, "(role:", userRole, ")");
    router.push(targetRoute);
  };

  const handleMarkAllRead = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ mark_all_read: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("[BELL] Mark all error:", err);
    }
  };

  const getIconForType = (type: Notification["type"]) => {
    switch (type) {
      case "task_assigned":
        return <Inbox size={13} className="text-orange-500" />;
      case "task_completed":
        return <CheckCircle2 size={13} className="text-green-500" />;
      case "project_submitted":
        return <FileText size={13} className="text-blue-500" />;
      case "project_approved":
        return <CheckCircle2 size={13} className="text-green-500" />;
      case "project_rejected":
        return <XCircle size={13} className="text-red-500" />;
      case "comment_added":
        return <MessageSquare size={13} className="text-purple-500" />;
      default:
        return <Bell size={13} className="text-neutral-400" />;
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 rounded-lg hover:bg-neutral-100 transition flex items-center justify-center text-neutral-600"
        title="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full text-white text-[9px] font-black flex items-center justify-center"
            style={{ backgroundColor: brandColor }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-neutral-200 shadow-xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
            <div className="text-xs font-bold text-neutral-900">Notifications</div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[10px] font-bold text-orange-600 hover:underline flex items-center gap-1"
              >
                <Check size={10} />
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-neutral-400">
                <Loader2 size={16} className="animate-spin mx-auto" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-neutral-400">
                Aucune notification pour le moment
              </div>
            ) : (
              <div>
                {notifications.map((notif) => (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => handleNotifClick(notif)}
                    className={`w-full px-4 py-3 text-left hover:bg-neutral-50 transition border-b border-neutral-50 last:border-b-0 ${
                      !notif.is_read ? "bg-orange-50/30" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 shrink-0">
                        {getIconForType(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-neutral-900 truncate">
                            {notif.title}
                          </span>
                          {!notif.is_read && (
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: brandColor }}
                            />
                          )}
                        </div>
                        {notif.message && (
                          <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
                            {notif.message}
                          </div>
                        )}
                        <div className="text-[10px] text-neutral-400 mt-0.5">
                          {formatRelativeTime(notif.created_at)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffHr < 24) return `il y a ${diffHr}h`;
  if (diffDay < 7) return `il y a ${diffDay}j`;
  return then.toLocaleDateString("fr-CH");
}
