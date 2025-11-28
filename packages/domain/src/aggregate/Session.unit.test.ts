import { SessionSegment } from "../entities/SessionSegment";
import { SegmentTooShort } from "../events/SegmentTooShort";
import { SessionPaused } from "../events/SessionPaused";
import { SessionResumed } from "../events/SessionResumed";
import { SessionStarted } from "../events/SessionStarted";
import { SessionStopped } from "../events/SessionStopped";
import { DateTime } from "../valueObjects/DateTime";
import { makeId, ULID } from "../valueObjects/ulid";
import { Session } from "./Session";

describe("Session", () => {
  let createdAt: DateTime;
  let timestamp: number;
  let categoryId: ULID;

  beforeEach(() => {
    timestamp = 0;
    createdAt = DateTime.create(timestamp);
    categoryId = makeId();
  });
  describe("creation", () => {
    it("should throw if categoryId is not provided", () => {
      // @ts-expect-error intentionally invalid type
      expect(() => new Session({ categoryId: null, createdAt })).toThrow();
    });
    it("should throw when createdAt is not provided", () => {
      // @ts-expect-error intentionally invalid type
      expect(() => new Session({ categoryId, createdAt: null })).toThrow();
    });
    it("should throw when segments passed but has broken sorting. segments[0].startedAt must be < segments[1].startedAt", () => {
      expect(
        () =>
          new Session({
            categoryId,
            createdAt,
            activeSegment: new SessionSegment({
              startedAt: DateTime.create(2),
            }),
            history: [
              new SessionSegment({ startedAt: DateTime.create(timestamp + 1) }),
              new SessionSegment({ startedAt: DateTime.create(timestamp) }),
            ],
          }),
      ).toThrow();
    });

    it("should throw when segments are overlapped. Each a.stoppedAt must be < b.startedAt", () => {
      expect(
        () =>
          new Session({
            categoryId,
            createdAt,
            activeSegment: new SessionSegment({
              startedAt: DateTime.create(timestamp + 500),
            }),
            history: [
              new SessionSegment({
                startedAt: DateTime.create(timestamp),
                stoppedAt: DateTime.create(timestamp + 1000),
              }),
            ],
          }),
      ).toThrow();
    });

    it("should create Session", () => {
      expect(
        () =>
          new Session({
            categoryId,
            createdAt,
            history: [
              new SessionSegment({ startedAt: DateTime.create(timestamp) }),
              new SessionSegment({ startedAt: DateTime.create(timestamp + 1) }),
            ],
          }),
      ).not.toThrow();

      expect(() => Session._validTestInstance()).not.toThrow();
    });

    it("should emit SessionStarted event when session is created", () => {
      const session = new Session({
        categoryId,
        createdAt,
      });
      const events = session.pullDomainEvents();
      const targetEvent = events.find((e) => e instanceof SessionStarted);

      expect(targetEvent).toBeDefined();
    });

    it("should create activeSegment and history if not provided (fresh Session)", () => {
      const session = new Session({ categoryId, createdAt });

      expect(session.history.length).toBe(0);
      expect(session.activeSegment?.state).toBe("active");
    });
  });

  describe("active segment", () => {
    it("should have at most one active segment at any time", () => {
      const session = Session._validTestInstance();

      // Check initial state
      expect(session.activeSegment).toBeDefined();

      // After pause - should have 0 active
      session.pause(DateTime.create(1000));
      expect(session.activeSegment).toBeNull();

      // After resume - should have 1 active
      session.resume(DateTime.create(2000));
      expect(session.activeSegment).toBeDefined();
    });
  });

  describe("pause", () => {
    it("should pause session", () => {
      const session = Session._validTestInstance();

      session.pause(session.activeSegment!.startedAt.add(1000));
      expect(session.state).toBe("paused");
    });
    it("should throw when pause NOT active session", () => {
      const session = Session._validTestInstance();

      session.stop(session.activeSegment!.startedAt.add(1000));
      expect(() => session.pause(DateTime.create(2000))).toThrow();

      const session2 = Session._validTestInstance();

      session2.pause(session2.activeSegment!.startedAt.add(1000));
      expect(() => session2.pause(DateTime.create(1000))).toThrow();
    });

    it("should emit SessionPaused event when session is paused", () => {
      const session = Session._validTestInstance();

      session.pause(DateTime.create(1000));

      const events = session.pullDomainEvents();
      const targetEvent = events.find((e) => e instanceof SessionPaused);

      expect(targetEvent).toBeDefined();
    });
    it("should discard segment < 300ms when pausing", () => {
      const session = Session._validTestInstance();
      const startTime = session.activeSegment!.startedAt;

      // Pause after only 200ms
      session.pause(startTime.add(200));

      // Segment should be discarded
      expect(session.history.length).toBe(0); // Or appropriate count

      // Should emit SegmentTooShort event
      const events = session.pullDomainEvents();
      const tooShortEvent = events.find((e) => e instanceof SegmentTooShort);

      expect(tooShortEvent).toBeDefined();
    });
  });

  describe("resume", () => {
    it("should resume paused session", () => {
      const session = Session._validTestInstance();
      const active = session.activeSegment!;

      session.pause(active!.startedAt.add(1000));
      session.resume(active!.startedAt.add(2000));
      expect(session.state).toBe("active");
    });
    it("should throw when session is not paused", () => {
      const session = Session._validTestInstance();

      expect(() =>
        session.resume(session.activeSegment!.startedAt.add(1000)),
      ).toThrow();

      const session2 = Session._validTestInstance();
      const active2 = session2.activeSegment!;

      session2.stop(active2.startedAt.add(1000));
      expect(() => session2.resume(active2.startedAt.add(1000))).toThrow();
    });

    it("should emit SessionResumed event when session is resumed", () => {
      const session = Session._validTestInstance();

      session.pause(DateTime.create(1000));
      session.resume(DateTime.create(2000));

      const events = session.pullDomainEvents();
      const targetEvent = events.find((e) => e instanceof SessionResumed);

      expect(targetEvent).toBeDefined();
    });
  });

  describe("stop", () => {
    it("should stop session", () => {
      const session = Session._validTestInstance();

      session.stop(session.activeSegment!.startedAt.add(1000));
      expect(session.state).toBe("stopped");
    });
    it("should throw when session is already stopped", () => {
      const session = Session._validTestInstance();
      const active = session.activeSegment!;

      session.stop(active.startedAt.add(1000));
      expect(() => session.stop(active.startedAt.add(1000))).toThrow();
    });

    it("should throw when stop in before last segment startedAt", () => {
      const session = Session._validTestInstance();

      expect(() =>
        session.stop(session.activeSegment!.startedAt.subtract(1000)),
      ).toThrow();
    });
    it("should stop paused session", () => {
      const session = Session._validTestInstance();
      const active = session.activeSegment!;

      session.pause(active.startedAt.add(1000));
      session.stop(active.startedAt.add(2000));
      expect(session.state).toBe("stopped");
    });

    it("should emit SessionStopped event when session is stopped", () => {
      const session = Session._validTestInstance();

      session.pause(DateTime.create(1000));
      session.stop(DateTime.create(2000));

      const events = session.pullDomainEvents();
      const targetEvent = events.find((e) => e instanceof SessionStopped);

      expect(targetEvent).toBeDefined();
    });
    it("should discard last segment < 300ms when stopping", () => {
      const session = Session._validTestInstance();
      const startTime = session.activeSegment!.startedAt;

      session.pause(startTime.add(1000));
      session.resume(startTime.add(2000));

      // Stop after only 100ms
      session.stop(session.activeSegment!.startedAt.add(100));

      // Last segment should be removed only ONE( first) left
      expect(session.history.length).toBe(1);

      // Should emit both SegmentTooShort and SessionStopped
      const events = session.pullDomainEvents();
      const tooShortEvent = events.find((e) => e instanceof SegmentTooShort);
      const stoppedEvent = events.find((e) => e instanceof SessionStopped);

      expect(tooShortEvent).toBeDefined();
      expect(stoppedEvent).toBeDefined();
    });

    it("should throw when stop with only one segment < 300ms. EmptySession ", () => {
      const session = Session._validTestInstance();
      const startTime = session.activeSegment!.startedAt;

      expect(() => session.stop(startTime.add(100))).toThrow();
    });
  });

  describe("getDuration", () => {
    it("should return duration of session", () => {
      const session = new Session({
        categoryId,
        createdAt,
        stoppedAt: DateTime.create(2000),
        history: [
          new SessionSegment({
            startedAt: DateTime.create(0),
            stoppedAt: DateTime.create(1000),
          }),
          new SessionSegment({
            startedAt: DateTime.create(1001),
            stoppedAt: DateTime.create(2000),
          }),
        ],
      });

      expect(session.getDurationMs()).toBe(1999);
    });

    it("should return null when session is not stopped", () => {
      const session = Session._validTestInstance();

      expect(session.getDurationMs()).toBeNull();
    });
  });

  describe("session with multiple segments (multiple pause result flow)", () => {
    it("have amount of segments according to pauses was made", () => {
      const session = new Session({
        createdAt,
        categoryId,
      });

      session.pause(DateTime.create(1000));
      session.resume(DateTime.create(2000));
      session.pause(DateTime.create(3000));
      session.resume(DateTime.create(4000));
      session.stop(DateTime.create(5000));
      expect(session.history.length).toBe(3);
      expect(session.getDurationMs()).toBe(3000);
    });
  });

  describe("ajustStartTime", () => {
    it("not implemented yet", () => {
      const session = Session._validTestInstance();

      expect(() => session.ajustStartTime(DateTime.create(1000))).toThrow();
    });
  });

  describe("ajustStopTime", () => {
    const session = Session._validTestInstance();

    expect(() => session.ajustStopTime(DateTime.create(1000))).toThrow();
  });
});
