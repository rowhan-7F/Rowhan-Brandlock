"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, FileText, Calendar, AlertTriangle, Sparkles,
  ChevronDown, ChevronUp, Inbox, Paperclip, ImagePlus, Download,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

// ============================================================
//  TYPES
// ============================================================

type Task = {
  id: string;
  tenant_id: string;
  title: string;
  brief: string | null;
  deadline: string | null;
  status: "open" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  assigned_to: string | null;
  linked_project_id: string | null;
  created_at: string;
};

type BriefAttachment = {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
};

type BriefImage = {
  id: string;
  public_url: string;
  thumbnail_url: string | null;
  filename: string;
};

// ============================================================
//  TASKS CAPSULE — Avec PDF + images affichées
// ============================================================

export default function TasksCapsule({ brandColor = "#F26522" }: { brandColor?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());

  const fetchTasks = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const res = await fetch("/api/admin/tasks?status=open", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const { tasks: t } = await res.json();
        setTasks(t || []);
      }
    } catch (err) {
      console.error("[TasksCapsule] erreur:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleStartTask = async (task: Task) => {
    setLoadingTaskId(task.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");

      const res = await fetch(`/api/admin/tasks/${task.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "create_project" }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Erreur de création du projet");
      }

      const { project } = await res.json();
      router.push(`/studio/${project.id}`);
    } catch (err: any) {
      alert("Erreur : " + err.message);
      setLoadingTaskId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 mb-6 flex items-center justify-center">
        <Loader2 size={16} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return null;
  }

  const priorityColors: Record<string, string> = {
    low: "text-neutral-400 bg-neutral-50 border-neutral-200",
    normal: "text-blue-600 bg-blue-50 border-blue-200",
    high: "text-orange-600 bg-orange-50 border-orange-200",
    urgent: "text-red-600 bg-red-50 border-red-200",
  };

  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl mb-6 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-orange-100/40 transition"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-sm"
            style={{ backgroundColor: brandColor }}
          >
            <Inbox size={16} />
          </div>
          <div className="text-left">
            <div className="text-[10px] font-black uppercase tracking-widest text-orange-600">
              Briefs à faire
            </div>
            <div className="text-sm font-bold text-neutral-900">
              {tasks.length} brief{tasks.length > 1 ? "s" : ""} de l&apos;administration
            </div>
          </div>
        </div>
        {expanded ? (
          <ChevronUp size={18} className="text-orange-600" />
        ) : (
          <ChevronDown size={18} className="text-orange-600" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-3">
          {tasks.map((task) => {
            const isLoading = loadingTaskId === task.id;
            const hasProject = !!task.linked_project_id;
            const isTaskExpanded = expandedTaskIds.has(task.id);

            return (
              <div
                key={task.id}
                className="bg-white rounded-xl border border-orange-100 overflow-hidden hover:border-orange-300 transition"
              >
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${priorityColors[task.priority]}`}
                    >
                      {task.priority === "urgent" && <AlertTriangle size={9} className="inline mr-1" />}
                      {task.priority}
                    </span>
                    {task.deadline && (
                      <span className="text-[10px] text-neutral-600 flex items-center gap-1 bg-neutral-50 px-2 py-0.5 rounded border border-neutral-200">
                        <Calendar size={10} />
                        {new Date(task.deadline).toLocaleDateString("fr-CH")}
                      </span>
                    )}
                    {hasProject && (
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">
                        En cours
                      </span>
                    )}
                  </div>

                  <div className="text-sm font-bold text-neutral-900 mb-1">{task.title}</div>

                  {task.brief && (
                    <div className={`text-xs text-neutral-600 mb-3 whitespace-pre-wrap ${isTaskExpanded ? "" : "line-clamp-3"}`}>
                      {task.brief}
                    </div>
                  )}

                  {/* ⭐ Bouton voir plus / détails */}
                  <button
                    type="button"
                    onClick={() => toggleTaskExpanded(task.id)}
                    className="text-[10px] font-bold uppercase tracking-wider text-orange-600 hover:text-orange-700 flex items-center gap-1 mb-3"
                  >
                    {isTaskExpanded ? (
                      <>
                        <ChevronUp size={11} />
                        Masquer les détails
                      </>
                    ) : (
                      <>
                        <ChevronDown size={11} />
                        Voir les pièces jointes & images
                      </>
                    )}
                  </button>

                  {/* ⭐ Section attachments + images (chargée à la demande) */}
                  {isTaskExpanded && <TaskAttachmentsSection taskId={task.id} />}

                  <div className="flex items-center justify-end gap-2 mt-2">
                    {hasProject ? (
                      <button
                        type="button"
                        onClick={() => router.push(`/studio/${task.linked_project_id}`)}
                        className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                      >
                        <FileText size={11} />
                        Continuer
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartTask(task)}
                        disabled={isLoading}
                        className="text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                        style={{ backgroundColor: brandColor }}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 size={11} className="animate-spin" />
                            Création...
                          </>
                        ) : (
                          <>
                            <Sparkles size={11} />
                            Démarrer ce brief
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ============================================================
//  TASK ATTACHMENTS SECTION
//  Charge à la demande les PDF + images d'un brief
// ============================================================
function TaskAttachmentsSection({ taskId }: { taskId: string }) {
  const [loading, setLoading] = useState(true);
  const [attachments, setAttachments] = useState<BriefAttachment[]>([]);
  const [images, setImages] = useState<BriefImage[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = { Authorization: `Bearer ${session?.access_token}` };

        const [attRes, imgRes] = await Promise.all([
          fetch(`/api/admin/briefs/${taskId}/attachments`, { headers }),
          fetch(`/api/admin/briefs/${taskId}/images`, { headers }),
        ]);

        if (!cancelled) {
          if (attRes.ok) {
            const { attachments: a } = await attRes.json();
            setAttachments(a || []);
          }
          if (imgRes.ok) {
            const { images: i } = await imgRes.json();
            setImages(i || []);
          }
        }
      } catch (err) {
        console.error("[TaskAttachmentsSection]", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [taskId]);

  if (loading) {
    return (
      <div className="py-3 text-center">
        <Loader2 size={14} className="animate-spin text-neutral-400 mx-auto" />
      </div>
    );
  }

  if (attachments.length === 0 && images.length === 0) {
    return (
      <div className="py-2 text-[10px] text-neutral-400 italic">
        Aucune pièce jointe pour ce brief
      </div>
    );
  }

  return (
    <div className="space-y-3 py-2 bg-orange-50/30 rounded-lg px-3 border border-orange-100">
      {/* PDF/fichiers */}
      {attachments.length > 0 && (
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-orange-700 mb-1.5 flex items-center gap-1">
            <Paperclip size={10} />
            Pièces jointes ({attachments.length})
          </div>
          <div className="space-y-1">
            {attachments.map((a) => (
              <AttachmentLink key={a.id} attachment={a} />
            ))}
          </div>
        </div>
      )}

      {/* Images */}
      {images.length > 0 && (
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-orange-700 mb-1.5 flex items-center gap-1">
            <ImagePlus size={10} />
            Images à utiliser ({images.length})
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {images.map((img) => (
              <a
                key={img.id}
                href={img.public_url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative aspect-square rounded overflow-hidden border-2 border-orange-200 hover:border-orange-400 transition group"
              >
                <img
                  src={img.thumbnail_url || img.public_url}
                  alt={img.filename}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-0 right-0 bg-orange-500 text-white text-[7px] font-black uppercase tracking-wider px-1 py-0.5 rounded-bl">
                  Brief
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================
//  ATTACHMENT LINK (PDF, Word, etc.)
// ============================================================
function AttachmentLink({ attachment }: { attachment: BriefAttachment }) {
  const sizeMB = attachment.file_size
    ? `${(attachment.file_size / 1024 / 1024).toFixed(1)} MB`
    : "";

  const iconType = attachment.file_type.includes("pdf") ? "📄" :
                   attachment.file_type.includes("word") ? "📝" :
                   attachment.file_type.includes("excel") || attachment.file_type.includes("sheet") ? "📊" :
                   "📎";

  return (
    <a
      href={attachment.file_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-2.5 py-1.5 bg-white hover:bg-orange-100 border border-orange-200 rounded-lg transition group"
    >
      <span className="text-sm">{iconType}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold text-neutral-900 truncate">{attachment.file_name}</div>
        {sizeMB && (
          <div className="text-[9px] text-neutral-500">{sizeMB}</div>
        )}
      </div>
      <Download size={11} className="text-neutral-400 group-hover:text-orange-600 shrink-0" />
    </a>
  );
}
