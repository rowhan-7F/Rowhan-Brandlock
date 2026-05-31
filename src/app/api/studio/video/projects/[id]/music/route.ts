import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_MUSIC_VOLUME } from "@/lib/video/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET_NAME = "video-music";
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getAuthenticatedUser(req: NextRequest): Promise<{ userId: string; tenantId: string | null; role: string } | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "");
  try {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabaseAdmin.from("user_profiles").select("tenant_id, role").eq("user_id", user.id).maybeSingle();
    if (!profile) return null;
    return { userId: user.id, tenantId: profile.tenant_id, role: profile.role };
  } catch { return null; }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  try {
    const body = await req.json();
    const { publicUrl, fileName, fileSize, fileType, duration_seconds } = body;
    if (!publicUrl || !fileName || !duration_seconds) return NextResponse.json({ error: "publicUrl, fileName, duration_seconds requis" }, { status: 400 });
    const { data: project, error: projectErr } = await supabaseAdmin.from("studio_video_projects").select("id, tenant_id, state_json, archived_at").eq("id", id).maybeSingle();
    if (projectErr || !project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (project.archived_at) return NextResponse.json({ error: "Project is archived" }, { status: 400 });
    if (user.role !== "super_admin" && project.tenant_id !== user.tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const currentState: any = project.state_json || {};
    const existingMix: any = currentState.audio_mix || {};
    const newStateJson = {
      ...currentState,
      music_audio: { url: publicUrl, filename: fileName, duration_seconds, size_bytes: fileSize || 0, mime_type: fileType || "audio/mpeg", uploaded_at: new Date().toISOString() },
      audio_mix: { main_volume: existingMix.main_volume ?? 1.0, voiceover_volume: existingMix.voiceover_volume ?? 1.0, music_volume: DEFAULT_MUSIC_VOLUME },
    };
    const { error: updateErr } = await supabaseAdmin.from("studio_video_projects").update({ state_json: newStateJson, updated_at: new Date().toISOString() }).eq("id", id);
    if (updateErr) return NextResponse.json({ error: `Erreur update: ${updateErr.message}` }, { status: 500 });
    return NextResponse.json({ success: true, music_audio: newStateJson.music_audio, audio_mix: newStateJson.audio_mix });
  } catch (err: any) {
    return NextResponse.json({ error: `Server error: ${err.message}` }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  try {
    const { data: project, error: projectErr } = await supabaseAdmin.from("studio_video_projects").select("id, tenant_id, state_json, archived_at").eq("id", id).maybeSingle();
    if (projectErr || !project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (project.archived_at) return NextResponse.json({ error: "Project is archived" }, { status: 400 });
    if (user.role !== "super_admin" && project.tenant_id !== user.tenantId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const stateJson: any = project.state_json || {};
    const musicUrl = stateJson.music_audio?.url;
    if (musicUrl) {
      const m = musicUrl.match(/\/storage\/v1\/object\/public\/video-music\/(.+)$/);
      if (m) await supabaseAdmin.storage.from(BUCKET_NAME).remove([m[1]]);
    }
    const { music_audio, ...rest } = stateJson;
    if (rest.audio_mix) {
      const { music_volume, ...mixRest } = rest.audio_mix;
      rest.audio_mix = mixRest;
    }
    const { error: updateErr } = await supabaseAdmin.from("studio_video_projects").update({ state_json: rest, updated_at: new Date().toISOString() }).eq("id", id);
    if (updateErr) return NextResponse.json({ error: `Erreur update: ${updateErr.message}` }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: `Server error: ${err.message}` }, { status: 500 });
  }
}