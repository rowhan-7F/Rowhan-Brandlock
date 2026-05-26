"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  MessageSquare, Send, Loader2, X,
} from "lucide-react";
import { supabase } from "../lib/supabase";

// ============================================================
//  PROJECT MESSAGES ICON
//  Icône + popover de messages pour un projet
//  Réutilisable côté admin ET graphiste
//  "Discussion entre Admin et Studio"
// ============================================================

type Comment = {
  id: string;
  author_id: string;
  author_email?: string;
  author_role: string;
  content: string;
  created_at: string;
};

type Props = {
  projectId: string;
  projectType?: "carousel" | "video";
  brandColor?: string;
};

export default function ProjectMessagesIcon({
  projectId,
  projectType = "carousel",
  brandColor = "#F26522",
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [posting, setPosting] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ============================================================
  //  Charger l'user courant pour filtrer mes propres messages
  // ============================================================
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setCurrentUserId(session.user.id);
      }
    })();
  }, []);

  // ============================================================
  //  Charge les messages
  // ============================================================
  const fetchMessages = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/studio/${projectType === "video" ? "video/projects" : "projects"}/${projectId}/comments`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error("[Messages] fetch error:", err);
    }
  }, [projectId]);

  // Auto-refresh toutes les 30s
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Load lastSeenAt depuis localStorage
  useEffect(() => {
    const key = `lastSeenMessages_${projectId}`;
    const stored = localStorage.getItem(key);
    setLastSeenAt(stored);
  }, [projectId]);

  // Refresh à l'ouverture + marque comme lu
  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchMessages().finally(() => setLoading(false));

      // Marque comme lu
      const now = new Date().toISOString();
      const key = `lastSeenMessages_${projectId}`;
      localStorage.setItem(key, now);
      setLastSeenAt(now);

      // Scroll to bottom après render
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [open, fetchMessages, projectId]);

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
  //  Envoyer un message
  // ============================================================
  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setPosting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/studio/${projectType === "video" ? "video/projects" : "projects"}/${projectId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ content: newMessage.trim() }),
      });
      if (!res.ok) throw new Error("Erreur envoi");
      const { comment } = await res.json();
      setComments((prev) => [...prev, comment]);
      setNewMessage("");

      // ⭐ Marque comme "lu" car je viens d'envoyer un message (donc je l'ai vu)
      const now = new Date().toISOString();
      const key = `lastSeenMessages_${projectId}`;
      localStorage.setItem(key, now);
      setLastSeenAt(now);

      // Scroll vers le bas
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      alert("Erreur : " + err.message);
    } finally {
      setPosting(false);
    }
  };

  // ============================================================
  //  Comptage non lus — EXCLUT MES PROPRES MESSAGES
  // ============================================================
  const unreadCount = comments.filter((c) => {
    // Ignore mes propres messages
    if (currentUserId && c.author_id === currentUserId) return false;
    // Compte si plus récent que la dernière visite
    if (!lastSeenAt) return true;
    return new Date(c.created_at) > new Date(lastSeenAt);
  }).length;

  const totalCount = comments.length;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 rounded-lg hover:bg-neutral-100 transition flex items-center justify-center text-neutral-600"
        title="Messages du projet"
      >
        <MessageSquare size={16} />
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
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl border border-neutral-200 shadow-xl overflow-hidden z-50 flex flex-col" style={{ maxHeight: "70vh" }}>
          <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-neutral-700" />
              <span className="text-xs font-bold text-neutral-900">
                Messages du projet
              </span>
              {totalCount > 0 && (
                <span className="text-[10px] text-neutral-500">({totalCount})</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-neutral-400 hover:text-neutral-700 transition"
            >
              <X size={14} />
            </button>
          </div>

          {/* Liste des messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-neutral-50/30">
            {loading ? (
              <div className="text-center py-8">
                <Loader2 size={16} className="animate-spin mx-auto text-neutral-400" />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-xs text-neutral-400">
                Aucun message pour ce projet
                <br />
                <span className="text-[10px]">Écris le premier message ci-dessous</span>
              </div>
            ) : (
              <>
                {comments.map((c) => (
                  <MessageItem
                    key={c.id}
                    comment={c}
                    isUnread={
                      // Mes propres messages ne sont jamais "non lus"
                      currentUserId && c.author_id === currentUserId
                        ? false
                        : lastSeenAt
                          ? new Date(c.created_at) > new Date(lastSeenAt)
                          : false
                    }
                    isMine={!!(currentUserId && c.author_id === currentUserId)}
                    brandColor={brandColor}
                  />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Champ d'envoi */}
          <div className="px-3 py-3 border-t border-neutral-200 bg-white">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Écrire un message... (Entrée pour envoyer)"
              rows={2}
              maxLength={2000}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs focus:border-orange-500 focus:outline-none resize-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={posting || !newMessage.trim()}
              className="mt-2 w-full text-white text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              style={{ backgroundColor: brandColor }}
            >
              {posting ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
              Envoyer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================
//  MESSAGE ITEM
// ============================================================
function MessageItem({
  comment, isUnread, isMine, brandColor,
}: {
  comment: Comment;
  isUnread: boolean;
  isMine: boolean;
  brandColor: string;
}) {
  // ⭐ Labels : Admin pour les admins, Studio pour le graphiste
  const roleColors: Record<string, string> = {
    tenant_admin: "bg-orange-100 text-orange-700",
    super_admin: "bg-purple-100 text-purple-700",
    graphist: "bg-blue-100 text-blue-700",
  };

  const roleLabel: Record<string, string> = {
    tenant_admin: "Admin",
    super_admin: "Admin",
    graphist: "Studio",
  };

  return (
    <div
      className={`rounded-lg p-2.5 border ${
        isMine
          ? "bg-orange-50/40 border-orange-100 ml-6"  // mes messages : align right léger
          : isUnread
            ? "bg-white border-orange-200 ring-1 ring-orange-100 mr-6"
            : "bg-white border-neutral-100 mr-6"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${roleColors[comment.author_role] || "bg-neutral-200 text-neutral-600"}`}
        >
          {roleLabel[comment.author_role] || comment.author_role}
          {isMine && " (vous)"}
        </span>
        {isUnread && !isMine && (
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: brandColor }}
          />
        )}
        <span className="text-[10px] text-neutral-400 ml-auto">
          {formatRelativeTime(comment.created_at)}
        </span>
      </div>
      <div className="text-xs text-neutral-800 whitespace-pre-wrap">{comment.content}</div>
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
