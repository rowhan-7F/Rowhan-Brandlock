// ============================================================
//  Hook custom pour polling d'un job de transcription
//  Polling progressif : 1s pour les 10 premières secondes, puis 3s
//  S'arrête automatiquement quand le job est completed/failed
// ============================================================

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export type RenderJob = {
  id: string;
  project_id: string;
  job_type: "transcribe" | "render" | "thumbnail";
  status: "queued" | "processing" | "completed" | "failed";
  progress_percent: number;
  progress_message: string | null;
  estimated_seconds_remaining: number | null;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  result_data: Record<string, unknown> | null;
};

type UseJobStatusOptions = {
  jobId: string | null;
  onComplete?: (job: RenderJob) => void;
  onError?: (job: RenderJob) => void;
};

type UseJobStatusReturn = {
  job: RenderJob | null;
  loading: boolean;
  error: string | null;
};

const POLL_FAST_MS = 1000;   // 1s les 10 premières secondes
const POLL_SLOW_MS = 3000;   // 3s ensuite
const POLL_FAST_THRESHOLD_MS = 10000;

export function useJobStatus({
  jobId,
  onComplete,
  onError,
}: UseJobStatusOptions): UseJobStatusReturn {
  const [job, setJob] = useState<RenderJob | null>(null);
  const [loading, setLoading] = useState<boolean>(!!jobId);
  const [error, setError] = useState<string | null>(null);

  // Refs pour callbacks stables et anti-stale closures
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  const fetchJob = useCallback(async (): Promise<RenderJob | null> => {
    if (!jobId) return null;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Pas de session active");
      return null;
    }

    const res = await fetch(`/api/studio/video/render-jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errBody.error || `HTTP ${res.status}`);
    }

    const { job: fetchedJob } = (await res.json()) as { job: RenderJob };
    return fetchedJob;
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const startTime = Date.now();

    const tick = async () => {
      if (cancelled) return;

      try {
        const fetched = await fetchJob();
        if (cancelled || !fetched) return;

        setJob(fetched);
        setLoading(false);
        setError(null);

        // Stop polling si terminé
        if (fetched.status === "completed") {
          onCompleteRef.current?.(fetched);
          return;
        }
        if (fetched.status === "failed") {
          onErrorRef.current?.(fetched);
          return;
        }

        // Continue polling — intervalle adaptatif
        const elapsed = Date.now() - startTime;
        const nextInterval =
          elapsed < POLL_FAST_THRESHOLD_MS ? POLL_FAST_MS : POLL_SLOW_MS;
        timeoutId = setTimeout(tick, nextInterval);
      } catch (err: any) {
        if (cancelled) return;
        setError(err.message || "Erreur inconnue");
        setLoading(false);
        // Retry après 5s en cas d'erreur réseau
        timeoutId = setTimeout(tick, 5000);
      }
    };

    setLoading(true);
    tick();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [jobId, fetchJob]);

  return { job, loading, error };
}