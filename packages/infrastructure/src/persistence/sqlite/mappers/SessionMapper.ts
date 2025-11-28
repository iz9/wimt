import { Session } from "@wimt/domain/aggregates";
import { SessionSegment } from "@wimt/domain/entities";
import { DateTime, type ULID } from "@wimt/domain/valueObjects";
import type {
  SessionRow,
  NewSessionRow,
  SessionSegmentRow,
  NewSessionSegmentRow,
} from "../schema";

export class SessionMapper {
  /**
   * Convert database rows (session + segments) to domain entity
   */
  toDomain(sessionRow: SessionRow, segmentRows: SessionSegmentRow[]): Session {
    // Ensure segmentRows is an array
    const segments = Array.isArray(segmentRows) ? segmentRows : [];

    // Map all segments
    const allSegments = segments.map((segmentRow) =>
      this.segmentToDomain(segmentRow),
    );

    // Find active segment and history
    const activeSegment =
      allSegments.find((seg) => seg.id === sessionRow.activeSegmentId) || null;

    const history = allSegments.filter(
      (seg) => seg.id !== sessionRow.activeSegmentId,
    );

    return new Session({
      id: sessionRow.id as ULID,
      categoryId: sessionRow.categoryId as ULID,
      createdAt: this.toDateTime(sessionRow.createdAt),
      stoppedAt: sessionRow.stoppedAt
        ? this.toDateTime(sessionRow.stoppedAt)
        : null,
      activeSegment,
      history,
    });
  }

  /**
   * Helper to convert various date formats to DateTime
   */
  private toDateTime(value: Date | number | null | undefined): DateTime {
    if (!value) {
      return DateTime.create(Date.now());
    }
    if (value instanceof Date) {
      return DateTime.create(value.getTime());
    }
    return DateTime.create(value);
  }

  /**
   * Convert domain entity to session database row
   */
  sessionToPersistence(session: Session): NewSessionRow {
    return {
      id: session.id,
      categoryId: session.categoryId,
      createdAt: new Date(session.createdAt.value),
      stoppedAt: session.stoppedAt ? new Date(session.stoppedAt.value) : null,
      activeSegmentId: session.activeSegment?.id || null,
    };
  }

  /**
   * Convert domain SessionSegment to database row
   */
  segmentToPersistence(
    segment: SessionSegment,
    sessionId: ULID,
  ): NewSessionSegmentRow {
    return {
      id: segment.id,
      sessionId: sessionId,
      startedAt: new Date(segment.startedAt.value),
      stoppedAt: segment.stoppedAt ? new Date(segment.stoppedAt.value) : null,
    };
  }

  /**
   * Convert database segment row to domain SessionSegment
   */
  private segmentToDomain(row: SessionSegmentRow): SessionSegment {
    return new SessionSegment({
      id: row.id as ULID,
      startedAt: this.toDateTime(row.startedAt),
      stoppedAt: row.stoppedAt ? this.toDateTime(row.stoppedAt) : null,
    });
  }

  /**
   * Get all segments for persistence (history + active)
   */
  getAllSegments(session: Session): SessionSegment[] {
    const segments = [...session.history];
    if (session.activeSegment) {
      segments.push(session.activeSegment);
    }
    return segments;
  }
}
