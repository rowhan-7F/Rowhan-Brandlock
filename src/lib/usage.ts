import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type LogEventInput = {
  client_email: string;
  brand_name?: string;
  event_type: 'carousel_generation' | 'idea_generation' | 'image_regen_ai' | 'image_regen_stock' | 'publicity_generation' | 'inspire_call' | 'library_tagging';
  provider: 'gemini' | 'pexels' | 'nano_banana' | 'unsplash' | 'loremflickr' | 'pixabay' | 'wikimedia' | 'gemini_vision';
  model?: string;
  units?: number;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  success?: boolean;
  metadata?: any;
};

export async function logUsageEvent(event: LogEventInput): Promise<void> {
  if (!event.client_email) return;
  try {
    const { error } = await supabaseAdmin.from('usage_events').insert([{
      ...event,
      client_email: event.client_email.toLowerCase().trim(),
      units: event.units ?? 1,
      input_tokens: event.input_tokens ?? 0,
      output_tokens: event.output_tokens ?? 0,
      cost_usd: event.cost_usd ?? 0,
      success: event.success ?? true,
      metadata: event.metadata ?? {}
    }]);
    if (error) console.error("[usage] insert error:", error.message);
  } catch (err: any) {
    console.error("[usage] failed:", err.message);
  }
}

// === Tarifs Google Gemini 2.5 Flash Lite (au 2025) ===
const GEMINI_INPUT_PER_TOKEN = 0.10 / 1_000_000;
const GEMINI_OUTPUT_PER_TOKEN = 0.40 / 1_000_000;
const GEMINI_GROUNDING_PER_QUERY = 0.035;
export const COST_NANO_BANANA_IMAGE = 0.04;

export function geminiTextCost(inputTokens: number, outputTokens: number, grounded: boolean = false): number {
  let cost = inputTokens * GEMINI_INPUT_PER_TOKEN + outputTokens * GEMINI_OUTPUT_PER_TOKEN;
  if (grounded) cost += GEMINI_GROUNDING_PER_QUERY;
  return cost;
}