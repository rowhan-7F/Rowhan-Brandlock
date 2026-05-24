"use client";

import { Filter, Search, X } from "lucide-react";

// ============================================================
//  PROJECT FILTERS - Phase 12 peaufinage
//
//  Filtres pour dashboard studio :
//  - Type : all / carousel / video
//  - Statut : all / draft / pending_approval / approved / rejected
//  - Tri : recent / oldest / title
//  - Search : titre du projet
// ============================================================

export type FilterType = "all" | "carousel" | "video";
export type FilterStatus = "all" | "draft" | "pending_approval" | "approved" | "rejected";
export type SortBy = "recent" | "oldest" | "title";

type Props = {
  filterType: FilterType;
  filterStatus: FilterStatus;
  sortBy: SortBy;
  search: string;
  onTypeChange: (v: FilterType) => void;
  onStatusChange: (v: FilterStatus) => void;
  onSortChange: (v: SortBy) => void;
  onSearchChange: (v: string) => void;
  totalCount: number;
};

export default function ProjectFilters({
  filterType,
  filterStatus,
  sortBy,
  search,
  onTypeChange,
  onStatusChange,
  onSortChange,
  onSearchChange,
  totalCount,
}: Props) {
  const hasActiveFilters = filterType !== "all" || filterStatus !== "all" || search.trim().length > 0;

  const resetFilters = () => {
    onTypeChange("all");
    onStatusChange("all");
    onSortChange("recent");
    onSearchChange("");
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-[300px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Rechercher un projet..."
          className="w-full pl-9 pr-8 py-2 border border-neutral-200 rounded-lg text-xs outline-none focus:border-[#B11E2F] focus:ring-2 focus:ring-[#B11E2F]/20"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
            title="Effacer"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Type filter */}
      <div className="flex items-center gap-1">
        <Filter size={12} className="text-neutral-400 ml-1" />
        <select
          value={filterType}
          onChange={(e) => onTypeChange(e.target.value as FilterType)}
          className="px-3 py-2 border border-neutral-200 rounded-lg text-xs font-medium outline-none focus:border-[#B11E2F] bg-white cursor-pointer hover:border-neutral-300"
        >
          <option value="all">Tous les types</option>
          <option value="carousel">Carrousels</option>
          <option value="video">Videos</option>
        </select>
      </div>

      {/* Status filter */}
      <select
        value={filterStatus}
        onChange={(e) => onStatusChange(e.target.value as FilterStatus)}
        className="px-3 py-2 border border-neutral-200 rounded-lg text-xs font-medium outline-none focus:border-[#B11E2F] bg-white cursor-pointer hover:border-neutral-300"
      >
        <option value="all">Tous les statuts</option>
        <option value="draft">Brouillons</option>
        <option value="pending_approval">En validation</option>
        <option value="approved">Approuves</option>
        <option value="rejected">A retravailler</option>
      </select>

      {/* Sort */}
      <select
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value as SortBy)}
        className="px-3 py-2 border border-neutral-200 rounded-lg text-xs font-medium outline-none focus:border-[#B11E2F] bg-white cursor-pointer hover:border-neutral-300"
      >
        <option value="recent">Plus recents</option>
        <option value="oldest">Plus anciens</option>
        <option value="title">Par titre A-Z</option>
      </select>

      {/* Reset + count */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={resetFilters}
          className="px-3 py-2 text-xs font-medium text-neutral-600 hover:text-[#B11E2F] hover:bg-neutral-50 rounded-lg transition flex items-center gap-1"
          title="Reinitialiser les filtres"
        >
          <X size={12} />
          Reset
        </button>
      )}

      <div className="ml-auto text-xs text-neutral-500 px-2">
        <strong className="text-neutral-700">{totalCount}</strong> projet{totalCount > 1 ? "s" : ""}
      </div>
    </div>
  );
}