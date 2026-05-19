import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Agent, setGlobalDispatcher } from "undici";
import { processImage } from "../../../../lib/imageProcessing";
import { tagImageWithVision } from "../../../../lib/imageTagging";
import { logUsageEvent, geminiTextCost } from "../../../../lib/usage";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
setGlobalDispatcher(new Agent({ connect: { rejectUnauthorized: false } }));

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min pour gros batchs

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function slugify(text: string): string {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const clientEmail = (formData.get('client_email') as string || '').toLowerCase().trim();
    const brandName = formData.get('brand_name') as string || '';
    const batchName = (formData.get('batch_name') as string || 'Sans nom').trim();
    const files = formData.getAll('files') as File[];

    if (!clientEmail) {
      return NextResponse.json({ error: "client_email manquant" }, { status: 400 });
    }
    if (!files.length) {
      return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
    }

    const folder = clientEmail;
    const batchSlug = slugify(batchName) || 'sans-nom';
    const results: any[] = [];
    const errors: any[] = [];

    for (const file of files) {
      try {
        // Vérif type
        if (!file.type.startsWith('image/')) {
          errors.push({ filename: file.name, error: "Fichier non-image ignoré" });
          continue;
        }

        const arrayBuffer = await file.arrayBuffer();
        const inputBuffer = Buffer.from(arrayBuffer);

        // 1. Compression + thumbnail
        const { fullSize, thumbnail, width, height, size_bytes } = await processImage(inputBuffer);

        // 2. Génération paths uniques
        const ts = Date.now() + '-' + Math.random().toString(36).substring(2, 7);
        const fileBaseName = slugify(file.name.replace(/\.[^/.]+$/, '')) || 'image';
        const fullPath = `${folder}/${batchSlug}/${ts}-${fileBaseName}.jpg`;
        const thumbPath = `${folder}/${batchSlug}/thumbs/${ts}-${fileBaseName}.jpg`;

        // 3. Upload Supabase Storage
        const { error: fullErr } = await supabaseAdmin.storage
          .from('brand-libraries')
          .upload(fullPath, fullSize, { contentType: 'image/jpeg', upsert: false });
        if (fullErr) throw new Error(`Upload full: ${fullErr.message}`);

        const { error: thumbErr } = await supabaseAdmin.storage
          .from('brand-libraries')
          .upload(thumbPath, thumbnail, { contentType: 'image/jpeg', upsert: false });
        if (thumbErr) throw new Error(`Upload thumb: ${thumbErr.message}`);

        // 4. Récupération URLs publiques
        const { data: { publicUrl: fullUrl } } = supabaseAdmin.storage.from('brand-libraries').getPublicUrl(fullPath);
        const { data: { publicUrl: thumbUrl } } = supabaseAdmin.storage.from('brand-libraries').getPublicUrl(thumbPath);

        // 5. Tagging IA via Gemini Vision
        const { metadata, inputTokens, outputTokens } = await tagImageWithVision(fullSize);

        // 6. Insert en DB
        const { data: inserted, error: dbErr } = await supabaseAdmin.from('brand_images').insert([{
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
          description: metadata?.description || null,
          tags: metadata?.tags || [],
          mood: metadata?.mood || null,
          quality_score: metadata?.quality_score || null,
          has_faces: metadata?.has_faces || false,
          focal_point_x: metadata?.focal_point_x ?? 0.5,
          focal_point_y: metadata?.focal_point_y ?? 0.5,
          dominant_colors: metadata?.dominant_colors || [],
          source: 'brand_owned',
          tagging_status: metadata ? 'done' : 'failed'
        }]).select().single();

        if (dbErr) throw new Error(`DB insert: ${dbErr.message}`);

        // 7. Log usage tagging
        if (metadata) {
          await logUsageEvent({
            client_email: clientEmail,
            brand_name: brandName,
            event_type: 'library_tagging',
            provider: 'gemini_vision',
            model: 'gemini-3.1-flash-lite',
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cost_usd: geminiTextCost(inputTokens, outputTokens, false),
            metadata: { image_id: inserted.id, batch_name: batchName }
          });
        }

        results.push(inserted);
        console.log(`✓ ${file.name} traité (${(size_bytes / 1024).toFixed(0)} ko)`);

      } catch (err: any) {
        console.error(`❌ Erreur sur ${file.name}:`, err.message);
        errors.push({ filename: file.name, error: err.message });
      }
    }

    return NextResponse.json({
      uploaded: results.length,
      failed: errors.length,
      images: results,
      errors
    });

  } catch (err: any) {
    console.error('❌ Crash upload library:', err);
    return NextResponse.json({ error: err.message || "Erreur serveur" }, { status: 500 });
  }
}