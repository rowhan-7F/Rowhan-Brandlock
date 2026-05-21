"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Send, MessageSquare } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ============================================================
//  PROJECT COMMENTS SECTION — Réutilisable
//  Affiche les commentaires d'un projet + permet d'en ajouter
//  Utilisé par : éditeur graphiste (/studio/[id])
//                page admin validation (/admin/tenant/projects/[id])
// ============================================================

type Comment = {
  id: string;
  author_id: string;
  author_email: string;
  author_role: string;
  content: string;
  created_at: string;
};

type Props = {
  projectId: string;
  brandColor?: string;
  /** Auto-refresh toutes les 30s par défaut */
  autoRefreshMs?: number;
};

export default function ProjectCommentsSection({
  projectId,
  brandColor = "#F26522",
  autoRefreshMs = 30000,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/studio/projects/${projectId}/comments`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const { comments: c } = await res.json();
        setComments(c || []);
      }
    } catch (err) {
      console.error("[ProjectCommentsSection]", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Chargement initial
  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefreshMs) return;
    const interval = setInterval(fetchComments, autoRefreshMs);
    return () => clearInterval(interval);
  }, [fetchComments, autoRefreshMs]);

  const handlePost = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/studio/projects/${projectId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Erreur envoi");
      }
      const { comment } = await res.json();
      setComments((prev) => [...prev, comment]);
      setNewComment("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  };

  const roleColors: Record<string, string> = {
    tenant_admin: "bg-orange-100 text-orange-700",
    super_admin: "bg-purple-100 text-purple-700",
    graphist: "bg-blue-100 text-blue-700",
  };

  const roleLabels: Record<string, string> = {
    tenant_admin: "Admin",
    super_admin: "Super admin",
    graphist: "Graphiste",
  };

  return (
    <section className="bg-white border border-neutral-200 rounded-xl p-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3 flex items-center gap-1.5">
        <MessageSquare size={12} />
        Commentaires {comments.length > 0 && `(${comments.length})`}
      </h3>

      {loading ? (
        <div className="text-center py-4">
          <Loader2 size={14} className="animate-spin text-neutral-400 mx-auto" />
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto mb-3">
          {comments.length === 0 ? (
            <div className="text-xs text-neutral-400 text-center py-4">
              Aucun commentaire pour le moment
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="bg-neutral-50 rounded-lg p-2.5">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${roleColors[c.author_role] || "bg-neutral-200 text-neutral-600"}`}>
                    {roleLabels[c.author_role] || c.author_role}
                  </span>
                  <span className="text-[10px] text-neutral-500 truncate">
                    {c.author_email}
                  </span>
                  <span className="text-[10px] text-neutral-400 ml-auto">
                    {formatRelativeTime(c.created_at)}
                  </span>
                </div>
                <div className="text-xs text-neutral-800 whitespace-pre-wrap">
                  {c.content}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="border-t border-neutral-100 pt-3">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Écrire un commentaire..."
          rows={3}
          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs focus:border-neutral-400 focus:outline-none resize-none"
          maxLength={2000}
          disabled={posting}
        />
        {error && (
          <div className="text-[10px] text-red-600 mt-1">{error}</div>
        )}
        <button
          type="button"
          onClick={handlePost}
          disabled={posting || !newComment.trim()}
          className="mt-2 w-full text-white text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition disabled:opacity-50"
          style={{ backgroundColor: brandColor }}
        >
          {posting ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
          Envoyer
        </button>
      </div>
    </section>
  );
}

// ============================================================
//  Helper : date relative
// ============================================================
function formatRelativeTime(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin}min`;
  if (diffHr < 24) return `il y a ${diffHr}h`;
  if (diffDay < 7) return `il y a ${diffDay}j`;
  return then.toLocaleDateString("fr-CH");
}
