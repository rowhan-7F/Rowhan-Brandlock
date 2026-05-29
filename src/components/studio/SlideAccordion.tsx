"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle, ChevronDown, ChevronRight, GripVertical, Trash2, CheckCircle2, Image as ImageIcon,
} from "lucide-react";
import MediaPicker, { SelectedImage } from "./MediaPicker";
import { supabase } from "@/lib/supabase";
import { getResolvedInputs as getResolvedInputsFromHelper } from "@/lib/formatOverrides";
import {
  getDefaultSubVariant, getSubVariantConfig, countFilledInputs,
  variantLabel, getAvailableVariants, getSubVariants,
} from "@/lib/studioHelpers";

// ============================================================
//  SlideAccordion (+ DynamicInput + ImageFieldWithPicker + Field)
//  Phase 9.4.5 - groupe d'edition d'une slide, extrait de page.tsx
// ============================================================
export default function SlideAccordion({
  slide, index, isOpen, onToggle, onDelete, onChangeVariant, onChangeInput,
  onCompleteSlide, config, userRole, tenantId,
  activeEditingFormat,
}: any) {
  const variant = slide.variant;
  const subVariant = (slide as any).subVariant || getDefaultSubVariant(config, variant);
  const subVariantConfig = getSubVariantConfig(config, variant, subVariant);
  const inputs = subVariantConfig?.inputs || [];

  // Sprint 3+4 : resoudre les inputs (base + overrides du format actif)
  const resolvedInputs = getResolvedInputsFromHelper(
    slide as any,
    activeEditingFormat || "carrousel_instagram"
  );

  const filled = countFilledInputs(slide, inputs);
  const isComplete = filled === inputs.length && inputs.length > 0;

  const review = (slide as any).review;
  const reviewStatus = review?.status;
  const reviewComment = review?.comment;

  const borderClass = reviewStatus === "needs_changes"
    ? "border-amber-300 ring-1 ring-amber-200"
    : reviewStatus === "ok"
      ? "border-green-300"
      : isOpen
        ? "border-neutral-300 shadow-sm bg-white"
        : "border-neutral-200 bg-neutral-50/50 hover:bg-white hover:border-neutral-300";

  return (
    <div className={`rounded-xl border transition-all ${borderClass} ${isOpen ? "bg-white shadow-sm" : ""}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="w-full px-3 py-2.5 flex items-center gap-2 text-left cursor-pointer select-none"
      >
        {!isOpen && <GripVertical size={13} className="text-neutral-300 shrink-0" />}
        {isOpen ? <ChevronDown size={14} className="text-neutral-400 shrink-0" /> : <ChevronRight size={14} className="text-neutral-400 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-neutral-900 truncate flex items-center gap-1.5">
            Slide {index + 1} · {variantLabel(config, variant)}
            {reviewStatus === "ok" && <CheckCircle2 size={11} className="text-green-600 shrink-0" />}
            {reviewStatus === "needs_changes" && <AlertCircle size={11} className="text-amber-600 shrink-0" />}
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">
            {filled}/{inputs.length} champs remplis
          </div>
        </div>
        {isComplete && !reviewStatus && <CheckCircle2 size={14} className="text-green-600 shrink-0" />}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded-md text-neutral-300 hover:text-red-500 hover:bg-red-50 transition shrink-0"
          title="Supprimer cette slide"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* ⭐ Slide approuvée (status ok) */}
      {reviewStatus === "ok" && (
        <div className="mx-3 mb-2 px-2 py-1.5 bg-green-50 border border-green-200 rounded flex items-center gap-1.5">
          <CheckCircle2 size={11} className="text-green-600 shrink-0" />
          <span className="font-bold uppercase tracking-wider text-[9px] text-green-700">
            Slide approuvée
          </span>
        </div>
      )}

      {/* Feedback admin (status needs_changes + commentaire) */}
      {reviewStatus === "needs_changes" && reviewComment?.trim() && (
        <div className="mx-3 mb-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-900">
          <div className="font-bold uppercase tracking-wider text-[9px] text-amber-700 mb-0.5">
            ⚠ Feedback admin
          </div>
          {reviewComment}
        </div>
      )}

      {isOpen && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-neutral-100">
          <Field label="Type de slide">
            <select
              value={variant}
              onChange={(e) => {
                const newVariant = e.target.value;
                const newSubVariant = getDefaultSubVariant(config, newVariant);
                onChangeVariant(newVariant, newSubVariant);
              }}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-xs outline-none focus:border-neutral-400 bg-white"
            >
              {getAvailableVariants(config).map((v: any) => (
                <option key={v.key} value={v.key}>{v.label || v.key}</option>
              ))}
            </select>
          </Field>

          {getSubVariants(config, variant).length > 1 && (
            <Field label="Variante">
              <select
                value={subVariant}
                onChange={(e) => onChangeVariant(variant, e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-xs outline-none focus:border-neutral-400 bg-white"
              >
                {getSubVariants(config, variant).map((sv: any) => (
                  <option key={sv.key} value={sv.key}>
                    {sv.label} — {sv.description}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {inputs.map((input: any, idx: number) => (
            <DynamicInput
              key={`${variant}-${subVariant}-${input.key}`}
              input={input}
              value={resolvedInputs[input.key]}
              onChange={(v: any) => onChangeInput(input.key, v)}
              isLast={idx === inputs.length - 1}
              onCompleteLast={onCompleteSlide}
              autoFocus={idx === 0 && isOpen}
              userRole={userRole}
              tenantId={tenantId}
            />
          ))}

          {inputs.length === 0 && (
            <div className="text-[10px] text-neutral-400 italic text-center py-2">
              Aucun champ défini pour ce type de slide
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
//  DYNAMIC INPUT
// ============================================================

function DynamicInput({
  input, value, onChange, isLast, onCompleteLast, autoFocus, userRole, tenantId,
}: any) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isLast) {
      e.preventDefault();
      onCompleteLast();
    }
  };

  const inputType = input.type || "text";
  const label = input.label || input.key;
  const placeholder = input.placeholder || "";

  if (inputType === "select") {
    return (
      <Field label={label} required={input.required}>
        <select
          value={value?.value || ""}
          onChange={(e) => onChange({ kind: "select", value: e.target.value })}
          autoFocus={autoFocus}
          className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-xs outline-none focus:border-neutral-400 bg-white"
        >
          <option value="">— Choisir —</option>
          {(input.options || []).map((opt: any) => {
            const optValue = typeof opt === "string" ? opt : opt.value;
            const optLabel = typeof opt === "string" ? opt : opt.label || opt.value;
            return <option key={optValue} value={optValue}>{optLabel}</option>;
          })}
        </select>
        {input.hint && <div className="text-[9px] text-neutral-400 italic mt-1">{input.hint}</div>}
      </Field>
    );
  }

  if (inputType === "image") {
    return (
      <ImageFieldWithPicker
        input={input} value={value} onChange={onChange}
        userRole={userRole} tenantId={tenantId}
      />
    );
  }

  if (inputType === "textarea" || inputType === "richText") {
    return (
      <Field label={label} required={input.required}>
        <textarea
          value={value?.value || ""}
          onChange={(e) => onChange({ kind: inputType === "richText" ? "richText" : "text", value: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-xs outline-none focus:border-neutral-400 bg-white resize-none"
        />
        {input.maxLength && (
          <div className="text-[9px] text-neutral-400 text-right mt-0.5">
            {(value?.value || "").length} / {input.maxLength}
          </div>
        )}
        {input.hint && <div className="text-[9px] text-neutral-400 italic mt-1">{input.hint}</div>}
      </Field>
    );
  }

  return (
    <Field label={label} required={input.required}>
      <input
        type="text"
        value={value?.value || ""}
        onChange={(e) => onChange({ kind: "text", value: e.target.value })}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        maxLength={input.maxLength}
        className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-xs outline-none focus:border-neutral-400 bg-white"
      />
      {input.maxLength && (
        <div className="text-[9px] text-neutral-400 text-right mt-0.5">
          {(value?.value || "").length} / {input.maxLength}
        </div>
      )}
      {input.hint && <div className="text-[9px] text-neutral-400 italic mt-1">{input.hint}</div>}
    </Field>
  );
}

// ============================================================
//  IMAGE FIELD AVEC PICKER
// ============================================================

function ImageFieldWithPicker({
  input, value, onChange, userRole, tenantId,
}: any) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [actualIsApproved, setActualIsApproved] = useState<boolean | null>(null);
  const imgValue = value?.value;

  useEffect(() => {
    if (!imgValue?.id) {
      setActualIsApproved(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("brand_images")
        .select("is_approved")
        .eq("id", imgValue.id)
        .maybeSingle();
      if (!cancelled) {
        setActualIsApproved(data?.is_approved ?? null);
      }
    })();
    return () => { cancelled = true; };
  }, [imgValue?.id]);

  const mediaPickerRole: "tenant_admin" | "graphist" | "super_admin" =
    userRole === "tenant_admin" || userRole === "super_admin" ? userRole : "graphist";

  const isReallyApproved = actualIsApproved === true ||
    (actualIsApproved === null && imgValue?.isApproved === true);
  const isReallyNotApproved = actualIsApproved === false ||
    (actualIsApproved === null && imgValue && imgValue.isApproved === false);

  return (
    <Field label={input.label || input.key} required={input.required}>
      {imgValue ? (
        <div className="relative rounded-lg overflow-hidden border border-neutral-200 group">
          <img src={imgValue.url} alt="" className="w-full h-32 object-cover" crossOrigin="anonymous" />
          {isReallyNotApproved && (
            <div className="absolute top-1 left-1 bg-orange-500 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">
              ⚠ Non validée
            </div>
          )}
          {isReallyApproved && (
            <div className="absolute top-1 left-1 bg-green-500 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">
              ✓ Validée
            </div>
          )}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="px-3 py-1.5 bg-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-neutral-100 transition"
            >
              Changer
            </button>
            <button
              type="button"
              onClick={() => onChange({ kind: "image", value: null })}
              className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-red-600 transition"
            >
              Retirer
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full px-3 py-4 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 text-center hover:border-orange-400 hover:bg-orange-50/30 transition group"
        >
          <ImageIcon size={18} className="text-neutral-400 group-hover:text-orange-500 mx-auto mb-1 transition" />
          <div className="text-[11px] font-bold text-neutral-600 group-hover:text-orange-600 transition">
            Choisir une image
          </div>
          <div className="text-[9px] text-neutral-400 mt-0.5">
            Médias ou import depuis votre PC
          </div>
        </button>
      )}

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(img: SelectedImage) => onChange({ kind: "image", value: img })}
        tenantId={tenantId}
        userRole={mediaPickerRole}
      />
    </Field>
  );
}

// ============================================================
//  FIELD + ADD SLIDE
// ============================================================

function Field({ label, required, children }: any) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1 flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </div>
      {children}
    </div>
  );
}

// ============================================================
//  SAVE INDICATOR + ERROR SCREEN
// ============================================================


