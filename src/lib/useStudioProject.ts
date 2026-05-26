"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "./supabase";

// ============================================================
//  TYPES — Structure d'un projet studio (état dans state_json)
// ============================================================

export type SlideInputValue =
  | { kind: "text"; value: string }
  | { kind: "select"; value: string }
  | { kind: "image"; value: { id: string; url: string; isApproved: boolean } | null }
  | { kind: "richText"; value: string };

export type SlideState = {
  id: string;
  variant: string;
  inputs: Record<string, SlideInputValue>;
};

export type ProjectState = {
  templateKey: string;
  slides: SlideState[];
  meta?: {
    lastEditedSlideId?: string;
  };
};

export type ProjectRow = {
  id: string;
  tenant_id: string;
  title: string;
  status: "draft" | "pending_approval" | "approved" | "archived" | "rejected";
  state_json: ProjectState;
  created_at: string;
  updated_at: string;
};

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type ProjectStatus = "loading" | "not_found" | "error" | "ready";

// === Type d'état simplifié : champs optionnels au lieu d'union discriminée ===
// On gère les transitions à la main dans le code, c'est plus lisible et TypeScript est content
export type StudioProjectState = {
  status: ProjectStatus;
  project: ProjectRow | null;
  saveStatus: SaveStatus;
  error: string | null;
};

// ============================================================
//  HOOK PRINCIPAL
// ============================================================

const AUTOSAVE_DELAY_MS = 2000;

const INITIAL_STATE: StudioProjectState = {
  status: "loading",
  project: null,
  saveStatus: "idle",
  error: null,
};

export function useStudioProject(projectId: string, tenantId: string | null) {
  const [state, setState] = useState<StudioProjectState>(INITIAL_STATE);

  // Refs pour gérer le debounce sans dépendances obsolètes
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestStateJsonRef = useRef<ProjectState | null>(null);
  const projectIdRef = useRef<string>(projectId);
  const tenantIdRef = useRef<string | null>(tenantId);

  // Met à jour les refs à chaque render
  useEffect(() => {
    // FIX 1 PREVENTIF : si projectId change, on cancel le timer en cours
    // pour eviter qu'un save fantome de l'ancien projet parte
    if (projectIdRef.current !== projectId) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      latestStateJsonRef.current = null;
    }
    
    projectIdRef.current = projectId;
    tenantIdRef.current = tenantId;
  }, [projectId, tenantId]);

  // === Chargement initial ===
  useEffect(() => {
    if (!tenantId) return;

    let cancelled = false;
    setState({
      status: "loading",
      project: null,
      saveStatus: "idle",
      error: null,
    });

    (async () => {
      const { data, error } = await supabase
        .from("studio_projects")
        .select("*")
        .eq("id", projectId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setState({
          status: "error",
          project: null,
          saveStatus: "idle",
          error: error.message,
        });
        return;
      }

      if (!data) {
        setState({
          status: "not_found",
          project: null,
          saveStatus: "idle",
          error: "Projet introuvable",
        });
        return;
      }

      // Normalise state_json (s'assure que slides est un tableau)
      const stateJson: ProjectState = data.state_json || {
        templateKey: "carrousel_instagram",
        slides: [],
      };
      if (!Array.isArray(stateJson.slides)) {
        stateJson.slides = [];
      }

      latestStateJsonRef.current = stateJson;

      setState({
        status: "ready",
        project: { ...data, state_json: stateJson } as ProjectRow,
        saveStatus: "idle",
        error: null,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, tenantId]);

  // === Sauvegarde réelle (appelée par le debounce) ===
  const performSave = useCallback(async () => {
    const stateJson = latestStateJsonRef.current;
    const pId = projectIdRef.current;
    const tId = tenantIdRef.current;

    if (!stateJson || !pId || !tId) return;

    setState((s) => ({ ...s, saveStatus: "saving" as SaveStatus }));

    try {
      const res = await fetch(`/api/studio/projects/${pId}/save`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state_json: stateJson }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Erreur sauvegarde");
      }

      // FIX 3 PREVENTIF : si le projectId a change pendant le save,
      // on ignore le resultat pour pas corrompre le nouvel etat
      if (projectIdRef.current !== pId) {
        console.warn("[useStudioProject] save result ignored : projectId changed");
        return;
      }

      setState((s) => ({ ...s, saveStatus: "saved" as SaveStatus }));

      // Reset le statut "saved" après 2s pour qu'il devienne "idle"
      setTimeout(() => {
        setState((s) =>
          s.saveStatus === "saved" ? { ...s, saveStatus: "idle" as SaveStatus } : s
        );
      }, 2000);
    } catch (err: any) {
      console.error("[useStudioProject] save error:", err);
      setState((s) => ({ ...s, saveStatus: "error" as SaveStatus }));
    }
  }, []);

  // === Update state_json + déclenche debounce ===
  const updateStateJson = useCallback(
    (updater: (prev: ProjectState) => ProjectState) => {
      setState((s) => {
        if (s.status !== "ready" || !s.project) return s;
        const newStateJson = updater(s.project.state_json);
        latestStateJsonRef.current = newStateJson;
        return {
          ...s,
          project: { ...s.project, state_json: newStateJson },
        };
      });

      // Reset le timer de save
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        performSave();
      }, AUTOSAVE_DELAY_MS);
    },
    [performSave]
  );

  // === Cleanup au unmount ===
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  return {
    state,
    updateStateJson,
  };
}
