import { Session } from "@wimt/domain/aggregates";
import { SessionSegment } from "@wimt/domain/entities";
import { DateTime, makeId } from "@wimt/domain/valueObjects";

import type { SessionRow, SessionSegmentRow } from "../schema";

import { SessionMapper } from "./SessionMapper";

describe("SessionMapper", () => {
  const mapper = new SessionMapper();

  describe("toDomain", () => {
    it("should map database rows to domain Session with active segment", () => {
      const sessionId = makeId();
      const activeSegmentId = makeId();
      const categoryId = makeId();
      const now = new Date();

      const sessionRow: SessionRow = {
        id: sessionId,
        categoryId: categoryId,
        createdAt: now,
        stoppedAt: null,
        activeSegmentId: activeSegmentId,
      };

      const segmentRows: SessionSegmentRow[] = [
        {
          id: activeSegmentId,
          sessionId: sessionId,
          startedAt: now,
          stoppedAt: null,
        },
      ];

      const session = mapper.toDomain(sessionRow, segmentRows);

      expect(session.id).toBe(sessionId);
      expect(session.categoryId).toBe(categoryId);
      expect(session.createdAt.value).toBe(now.getTime());
      expect(session.stoppedAt).toBeNull();
      expect(session.activeSegment).not.toBeNull();
      expect(session.activeSegment?.id).toBe(activeSegmentId);
      expect(session.history.length).toBe(0);
      expect(session.state).toBe("active");
    });

    it("should map database rows to stopped Session with history", () => {
      const sessionId = makeId();
      const segment1Id = makeId();
      const segment2Id = makeId();
      const categoryId = makeId();
      const startTime = new Date("2024-01-01T10:00:00Z");
      const stopTime = new Date("2024-01-01T11:00:00Z");

      const sessionRow: SessionRow = {
        id: sessionId,
        categoryId: categoryId,
        createdAt: startTime,
        stoppedAt: stopTime,
        activeSegmentId: null,
      };

      const segmentRows: SessionSegmentRow[] = [
        {
          id: segment1Id,
          sessionId: sessionId,
          startedAt: startTime,
          stoppedAt: new Date("2024-01-01T10:25:00Z"), // 25 min
        },
        {
          id: segment2Id,
          sessionId: sessionId,
          startedAt: new Date("2024-01-01T10:35:00Z"), // 10 min gap
          stoppedAt: stopTime,
        },
      ];

      const session = mapper.toDomain(sessionRow, segmentRows);

      expect(session.id).toBe(sessionId);
      expect(session.state).toBe("stopped");
      expect(session.stoppedAt).not.toBeNull();
      expect(session.stoppedAt?.value).toBe(stopTime.getTime());
      expect(session.activeSegment).toBeNull();
      expect(session.history.length).toBe(2);
    });

    it("should map paused Session (no active segment, no stopTime)", () => {
      const sessionId = makeId();
      const segmentId = makeId();
      const categoryId = makeId();
      const now = new Date();

      const sessionRow: SessionRow = {
        id: sessionId,
        categoryId: categoryId,
        createdAt: now,
        stoppedAt: null,
        activeSegmentId: null,
      };

      const segmentRows: SessionSegmentRow[] = [
        {
          id: segmentId,
          sessionId: sessionId,
          startedAt: now,
          stoppedAt: new Date(now.getTime() + 60000),
        },
      ];

      const session = mapper.toDomain(sessionRow, segmentRows);

      expect(session.state).toBe("paused");
      expect(session.activeSegment).toBeNull();
      expect(session.history.length).toBe(1);
      expect(session.stoppedAt).toBeNull();
    });

    it("should handle empty segments array", () => {
      const sessionId = makeId();
      const categoryId = makeId();
      const now = new Date();

      const sessionRow: SessionRow = {
        id: sessionId,
        categoryId: categoryId,
        createdAt: now,
        stoppedAt: null,
        activeSegmentId: null,
      };

      const session = mapper.toDomain(sessionRow, []);

      expect(session.id).toBe(sessionId);
      expect(session.activeSegment).toBeNull();
      expect(session.history.length).toBe(0);
    });

    it("should handle non-array segmentRows gracefully", () => {
      const sessionId = makeId();
      const categoryId = makeId();
      const now = new Date();

      const sessionRow: SessionRow = {
        id: sessionId,
        categoryId: categoryId,
        createdAt: now,
        stoppedAt: null,
        activeSegmentId: null,
      };

      // Pass non-array (simulating potential mock issue)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = mapper.toDomain(sessionRow, undefined as any);

      expect(session.id).toBe(sessionId);
      expect(session.history.length).toBe(0);
    });
  });

  describe("sessionToPersistence", () => {
    it("should map active Session to database row", () => {
      const session = new Session({
        categoryId: makeId(),
        createdAt: DateTime.create(Date.now()),
      });

      const row = mapper.sessionToPersistence(session);

      expect(row.id).toBe(session.id);
      expect(row.categoryId).toBe(session.categoryId);
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.createdAt.getTime()).toBe(session.createdAt.value);
      expect(row.stoppedAt).toBeNull();
      expect(row.activeSegmentId).toBe(session.activeSegment?.id);
    });

    it("should map stopped Session to database row", () => {
      const now = DateTime.create(Date.now());
      const stopTime = now.add(60, "second");

      const session = new Session({
        id: makeId(), // Provide ID to prevent auto-start
        categoryId: makeId(),
        createdAt: now,
        activeSegment: null,
        history: [
          new SessionSegment({
            startedAt: now,
            stoppedAt: stopTime,
          }),
        ],
        stoppedAt: stopTime,
      });

      const row = mapper.sessionToPersistence(session);

      expect(row.id).toBe(session.id);
      expect(row.stoppedAt).toBeInstanceOf(Date);
      expect(row.stoppedAt?.getTime()).toBe(stopTime.value);
      expect(row.activeSegmentId).toBeNull();
    });

    it("should map paused Session to database row", () => {
      const now = DateTime.create(Date.now());

      const session = new Session({
        id: makeId(), // Provide ID to prevent auto-start
        categoryId: makeId(),
        createdAt: now,
        activeSegment: null,
        history: [
          new SessionSegment({
            startedAt: now,
            stoppedAt: now.add(30, "second"),
          }),
        ],
      });

      const row = mapper.sessionToPersistence(session);

      expect(row.stoppedAt).toBeNull();
      expect(row.activeSegmentId).toBeNull();
    });
  });

  describe("segmentToPersistence", () => {
    it("should map active SessionSegment to database row", () => {
      const sessionId = makeId();
      const segment = new SessionSegment({
        startedAt: DateTime.create(Date.now()),
      });

      const row = mapper.segmentToPersistence(segment, sessionId);

      expect(row.id).toBe(segment.id);
      expect(row.sessionId).toBe(sessionId);
      expect(row.startedAt).toBeInstanceOf(Date);
      expect(row.startedAt.getTime()).toBe(segment.startedAt.value);
      expect(row.stoppedAt).toBeNull();
    });

    it("should map stopped SessionSegment to database row", () => {
      const sessionId = makeId();
      const now = DateTime.create(Date.now());
      const stopTime = now.add(60, "second");

      const segment = new SessionSegment({
        startedAt: now,
        stoppedAt: stopTime,
      });

      const row = mapper.segmentToPersistence(segment, sessionId);

      expect(row.id).toBe(segment.id);
      expect(row.sessionId).toBe(sessionId);
      expect(row.stoppedAt).toBeInstanceOf(Date);
      expect(row.stoppedAt?.getTime()).toBe(stopTime.value);
    });
  });

  describe("getAllSegments", () => {
    it("should return all segments including active", () => {
      const session = new Session({
        categoryId: makeId(),
        createdAt: DateTime.create(Date.now()),
      });

      const segments = mapper.getAllSegments(session);

      expect(segments.length).toBe(1);
      expect(segments[0]).toBe(session.activeSegment);
    });

    it("should return history segments when no active segment", () => {
      const now = DateTime.create(Date.now());
      const session = new Session({
        id: makeId(), // Provide ID to prevent auto-start
        categoryId: makeId(),
        createdAt: now,
        activeSegment: null,
        history: [
          new SessionSegment({
            startedAt: now,
            stoppedAt: now.add(25, "second"), // 25 sec
          }),
          new SessionSegment({
            startedAt: now.add(35, "second"), // 10 sec gap
            stoppedAt: now.add(60, "second"),
          }),
        ],
      });

      const segments = mapper.getAllSegments(session);

      expect(segments.length).toBe(2);
      expect(segments).toEqual(session.history);
    });

    it("should return history + active segment", () => {
      const now = DateTime.create(Date.now());
      const session = new Session({
        categoryId: makeId(),
        createdAt: now,
      });

      // Pause to create history
      session.pause(now.add(60, "second"));
      // Resume to create new active segment
      session.resume(now.add(90, "second"));

      const segments = mapper.getAllSegments(session);

      expect(segments.length).toBe(2); // 1 history + 1 active
      expect(segments).toContain(session.activeSegment);
      expect(segments[0]).toBe(session.history[0]);
    });

    it("should return empty array for session with no segments", () => {
      const session = new Session({
        id: makeId(), // Provide ID to prevent auto-start
        categoryId: makeId(),
        createdAt: DateTime.create(Date.now()),
        activeSegment: null,
        history: [],
      });

      const segments = mapper.getAllSegments(session);

      expect(segments.length).toBe(0);
    });
  });

  describe("date handling", () => {
    it("should handle Date objects from database", () => {
      const now = new Date();
      const sessionRow: SessionRow = {
        id: makeId(),
        categoryId: makeId(),
        createdAt: now,
        stoppedAt: null,
        activeSegmentId: null,
      };

      const session = mapper.toDomain(sessionRow, []);

      expect(session.createdAt.value).toBe(now.getTime());
    });

    it("should handle timestamp numbers from mock", () => {
      const timestamp = Date.now();
      const sessionRow: SessionRow = {
        id: makeId(),
        categoryId: makeId(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createdAt: timestamp as any, // Mock might return number
        stoppedAt: null,
        activeSegmentId: null,
      };

      const session = mapper.toDomain(sessionRow, []);

      expect(session.createdAt.value).toBe(timestamp);
    });
  });

  describe("round-trip mapping", () => {
    it("should preserve data through toPersistence and toDomain", () => {
      const originalSession = new Session({
        categoryId: makeId(),
        createdAt: DateTime.create(Date.now()),
      });

      // Convert to persistence
      const sessionRow = mapper.sessionToPersistence(originalSession);
      const allSegments = mapper.getAllSegments(originalSession);
      const segmentRows = allSegments.map((seg) =>
        mapper.segmentToPersistence(seg, originalSession.id),
      );

      // Convert back to domain
      const reconstructedSession = mapper.toDomain(
        sessionRow as SessionRow,
        segmentRows as SessionSegmentRow[],
      );

      expect(reconstructedSession.id).toBe(originalSession.id);
      expect(reconstructedSession.categoryId).toBe(originalSession.categoryId);
      expect(reconstructedSession.createdAt.value).toBe(
        originalSession.createdAt.value,
      );
      expect(reconstructedSession.state).toBe(originalSession.state);
    });
  });
});
