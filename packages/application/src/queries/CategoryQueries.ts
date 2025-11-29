// ============================================
// Category Query DTOs (Read Operations)
// ============================================

/**
 * DTO for full category details
 * Used by: Category detail view, edit forms
 */
export interface CategoryDTO {
  categoryId: string;
  name: string;
  color: string | null;
  icon: string | null;
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * DTO for category list item (lightweight)
 * Used by: Category picker, dropdowns, lists
 */
export interface CategoryListItemDTO {
  categoryId: string;
  name: string;
  color: string | null;
  icon: string | null;
  isArchived: boolean;
}

/**
 * DTO for category summary (minimal data)
 * Used by: Quick selection, autocomplete
 */
export interface CategorySummaryDTO {
  categoryId: string;
  name: string;
  color: string | null;
}

/**
 * DTO for category with statistics
 * Used by: Dashboard, category overview
 */
export interface CategoryWithStatsDTO {
  categoryId: string;
  name: string;
  color: string | null;
  icon: string | null;
  isArchived: boolean;
  // Statistics
  totalSessions: number;
  activeSessions: number;
  totalDurationMs: number;
  averageDurationMs: number;
  lastUsedAt: number | null;
  // Calculated fields
  percentageOfTotal: number; // % of all time
  formattedTotalDuration: string; // e.g., "25h 30m"
}
