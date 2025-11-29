// ============================================
// Session Query DTOs (Read Operations)
// ============================================

/**
 * DTO for active session with real-time timer data
 * Used by: Timer screen, status widgets
 */
export interface ActiveSessionDTO {
  sessionId: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string | null;
  categoryIcon: string | null;
  state: "active" | "paused";
  startedAt: number; // UTC milliseconds
  currentSegmentStartedAt: number; // For current active/paused segment
  elapsedMs: number; // Pre-calculated total duration
  canPause: boolean;
  canResume: boolean;
  canStop: boolean;
}

/**
 * DTO for full session details with all segments
 * Used by: Session history, session detail view
 */
export interface SessionDTO {
  sessionId: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string | null;
  state: "active" | "paused" | "stopped";
  createdAt: number;
  startedAt: number;
  stoppedAt: number | null;
  totalDurationMs: number;
  segments: SessionSegmentDTO[];
  segmentCount: number;
}

/**
 * DTO for session list item (lightweight)
 * Used by: Session history list, reports
 */
export interface SessionListItemDTO {
  sessionId: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string | null;
  state: "active" | "paused" | "stopped";
  startedAt: number;
  stoppedAt: number | null;
  totalDurationMs: number;
  formattedDuration: string; // e.g., "1h 30m"
}

/**
 * DTO for a single session segment
 * Used by: Session detail view
 */
export interface SessionSegmentDTO {
  segmentId: string;
  startTime: number; // UTC milliseconds
  endTime: number | null; // null if still active
  durationMs: number;
  isPaused: boolean;
}

/**
 * DTO for session statistics
 * Used by: Dashboard, reports
 */
export interface SessionStatsDTO {
  totalSessions: number;
  activeSessions: number;
  totalDurationMs: number;
  averageDurationMs: number;
  longestSessionMs: number;
  todayDurationMs: number;
  thisWeekDurationMs: number;
}
