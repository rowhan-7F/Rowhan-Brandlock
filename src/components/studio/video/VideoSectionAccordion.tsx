"use client";

import { ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";

type Props = {
  number: string;
  title: string;
  subtitle?: string;
  done?: boolean;
  icon?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

export default function VideoSectionAccordion({
  number, title, subtitle, done, icon, isOpen, onToggle, children,
}: Props) {
  return (
    <div className={`rounded-xl border transition-all ${isOpen ? "border-neutral-300 bg-white shadow-sm" : "border-neutral-200 bg-neutral-50/50 hover:bg-white hover:border-neutral-300"}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-center gap-2 text-left select-none"
      >
        <span className="text-[10px] font-black tabular-nums text-neutral-400 shrink-0 w-5">{number}</span>
        {icon && <span className="text-neutral-500 shrink-0">{icon}</span>}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-neutral-900 truncate flex items-center gap-1.5">
            {title}
            {done && <CheckCircle2 size={11} className="text-green-600 shrink-0" />}
          </div>
          {subtitle && <div className="text-[10px] text-neutral-400 mt-0.5 truncate">{subtitle}</div>}
        </div>
        {isOpen ? <ChevronDown size={14} className="text-neutral-400 shrink-0" /> : <ChevronRight size={14} className="text-neutral-400 shrink-0" />}
      </button>
      {isOpen && (
        <div className="px-3 pb-3 pt-1 border-t border-neutral-100">
          {children}
        </div>
      )}
    </div>
  );
}