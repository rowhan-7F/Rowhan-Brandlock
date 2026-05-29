import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Agent, setGlobalDispatcher } from "undici";
import { processImage } from "../../../../lib/imageProcessing";
import { tagImageWithVision } from "../../../../lib/imageTagging";
import { logUsageEvent, geminiTextCost } from "../../../../lib/usage";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
setGlobalDispatcher(new Agent({ connect: { rejectUnauthorized: false } }));

export const runtime = "nodejs";
export const maxDuration = 300;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// ============================================================
//  Authentication helper (inline, Bearer token)
// ============================================================
async function authenticate(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Unauthorized", status: 401 };
  }
  const token = authHeader.substring("Bearer ".length);
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData.user) {
    return { error: "Invalid token", status: 401 };
  }
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("user_id, email, role, scope, tenant_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!profile) {
    return { error: "Profile not found", status: 403 };
  }
  return { profile };
}

export async function POST(req: Request) {
  try {
    // ============================================================
    //  Phase 11 - Auth + tenant_id automatique
    //  Workflow : upload graphist/admin -> brand_images is_approved=false
    //  Admin tenant valide ensuite via /admin/tenant/library
    // ============================================================
    const auth = await authenticate(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { profile } = auth;

    // Phase 9.3.22 : auto-approve si le tenant a active "toujours approuver"
    let autoApproveImages = false;
    if (profile.tenant_id) {
      const { data: tcfg } = await supabaseAdmin
        .from("tenant_configs")
        .select("config_json")
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle();
      autoApproveImages = (tcfg?.config_json as any)?.autoApproveImages === true;
    }

    if (!profile.tenant_id && profile.role !== "super_admin") {
      return NextResponse.json({ error: "Tenant requis" }, { status: 400 });
    }

    const formData = await req.formData();
    const batchName = (formData.get("batch_name") as string || "Sans nom").trim();
    const relatedTaskId = formData.get("related_task_id") as string | null;
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "Aucun fichier recu" }, { status: 400 });
    }

    // Fallback compat : ancien code envoyait client_email + brand_name
    const clientEmail = (formData.get("client_email") as string || profile.email || "").toLowerCase().trim();
    const brandName = formData.get("brand_name") as string || (profile.tenant_id || "");

    // Storage path organise par tenant + email
    const folder = profile.tenant_id || clientEmail;
    const batchSlug = slugify(batchName) || "sans-nom";
    const results: any[] = [];
    const errors: any[] = [];

    for (const file of files) {
      try {
        if (!file.type.startsWith("image/")) {
          errors.push({ filename: file.name, error: "Fichier non-image ignore" });
          continue;
        }

        const arrayBuffer = await file.arrayBuffer();
        const inputBuffer = Buffer.from(arrayBuffer);

        const { fullSize, thumbnail, width, height, size_bytes } = await processImage(inputBuffer);

        const ts = Date.now() + "-" + Math.random().toString(36).substring(2, 7);
        const fileBaseName = slugify(file.name.replace(/\.[^/.]+$/, "")) || "image";
        const fullPath = `${folder}/${batchSlug}/${ts}-${fileBaseName}.jpg`;
        const thumbPath = `${folder}/${batchSlug}/thumbs/${ts}-${fileBaseName}.jpg`;

        const { error: fullErr } = await supabaseAdmin.storage
          .from("brand-libraries")
          .upload(fullPath, fullSize, { contentType: "image/jpeg", upsert: false });
        if (fullErr) throw new Error(`Upload full: ${fullErr.message}`);

        const { error: thumbErr } = await supabaseAdmin.storage
          .from("brand-libraries")
          .upload(thumbPath, thumbnail, { contentType: "image/jpeg", upsert: false });
        if (thumbErr) throw new Error(`Upload thumb: ${thumbErr.message}`);

        const { data: { publicUrl: fullUrl } } = supabaseAdmin.storage.from("brand-libraries").getPublicUrl(fullPath);
        const { data: { publicUrl: thumbUrl } } = supabaseAdmin.storage.from("brand-libraries").getPublicUrl(thumbPath);

        // Tagging IA (peut planter sans bloquer)
        let metadata: any = null;
        let inputTokens = 0;
        let outputTokens = 0;
        try {
          const tagResult = await tagImageWithVision(fullSize);
          metadata = tagResult.metadata;
          inputTokens = tagResult.inputTokens;
          outputTokens = tagResult.outputTokens;
        } catch (taggingErr: any) {
          console.warn(`[upload] tagging IA failed for ${file.name}:`, taggingErr.message);
        }

        // Insert en DB avec tenant_id + uploaded_by + is_approved=false
        const { data: inserted, error: dbErr } = await supabaseAdmin
          .from("brand_images")
          .insert([{
            tenant_id: profile.tenant_id,
            uploaded_by: profile.user_id,
            is_approved: autoApproveImages, // Phase 9.3.22 : true si tenant auto-approve
            approved_at: autoApproveImages ? new Date().toISOString() : null,
            approved_by: autoApproveImages ? profile.user_id : null,
            client_email: clientEmail,
            brand_name: brandName,
            storage_path: fullPath,
            public_url: fullUrl,
            thumbnail_url: thumbUrl,
            filename: file.name,
            width,
            height,
            size_bytes,
            batch_name: batchName,
            related_task_id: relatedTaskId || null,
            description: metadata?.description || null,
            tags: metadata?.tags || [],
            mood: metadata?.mood || null,
            quality_score: metadata?.quality_score || null,
            has_faces: metadata?.has_faces || false,
            focal_point_x: metadata?.focal_point_x ?? 0.5,
            focal_point_y: metadata?.focal_point_y ?? 0.5,
            dominant_colors: metadata?.dominant_colors || [],
            source: "brand_owned",
            tagging_status: metadata ? "done" : "failed",
          }])
          .select()
          .single();

        if (dbErr) throw new Error(`DB insert: ${dbErr.message}`);

        if (metadata) {
          await logUsageEvent({
            client_email: clientEmail,
            brand_name: brandName,
            event_type: "library_tagging",
            provider: "gemini_vision",
            model: "gemini-3.1-flash-lite",
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cost_usd: geminiTextCost(inputTokens, outputTokens, false),
            metadata: { image_id: inserted.id, batch_name: batchName },
          });
        }

        results.push(inserted);
        console.log(`OK ${file.name} traite (${(size_bytes / 1024).toFixed(0)} ko) tenant=${profile.tenant_id}`);
      } catch (err: any) {
        console.error(`ERR ${file.name}:`, err.message);
        errors.push({ filename: file.name, error: err.message });
      }
    }

    return NextResponse.json({
      uploaded: results.length,
      failed: errors.length,
      images: results,
      errors,
    });
  } catch (err: any) {
    console.error("Crash upload library:", err);
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}
