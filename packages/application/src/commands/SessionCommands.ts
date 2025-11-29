// ============================================
// Session Command DTOs
// ============================================

export interface PauseSessionCommand {
  sessionId: string;
}

export interface PauseSessionResult {
  sessionId: string;
  pausedAt: number;
}

export interface ResumeSessionCommand {
  sessionId: string;
}

export interface ResumeSessionResult {
  sessionId: string;
  resumedAt: number;
}

export interface StartSessionCommand {
  categoryId: string;
}

export interface StartSessionResult {
  sessionId: string;
  startedAt: number; // UTC milliseconds
}

export interface StopSessionCommand {
  sessionId: string;
}

export interface StopSessionResult {
  sessionId: string;
  stoppedAt: number;
  totalDurationMs: number;
}
