import { DateTime } from "../valueObjects/DateTime";
import { SessionSegment } from "./SessionSegment";
import { SegmentAlreadyStoppedError } from "../errors/SegmentAlreadyStoppedError";

describe("SessionSegment", () => {
  let timestamp: number;
  let segment: SessionSegment;
  beforeEach(() => {
    timestamp = Date.now();
    segment = new SessionSegment({
      startedAt: DateTime.create(timestamp),
    });
  });
  describe("creation", () => {
    it("should create a session segment with readonly createdAt", () => {
      expect(segment.startedAt.isSame(DateTime.create(timestamp))).toBe(true);
      // @ts-expect-error intentionally try to change readonly property
      expect(() => (segment.startedAt = DateTime.create(timestamp))).toThrow();
      expect(segment.state).toBe("active");
      expect(segment.stoppedAt).toBeNull();
    });
  });

  describe("recreation", () => {
    it("should recreate a session segment with the same id and createdAt", () => {
      const stoppedDateTime = segment.startedAt.add(1000);

      segment.stop(stoppedDateTime);

      const recreatedSessionSegment = new SessionSegment({
        id: segment.id,
        startedAt: segment.startedAt,
        stoppedAt: segment.stoppedAt,
      });

      expect(recreatedSessionSegment.id).toBe(segment.id);
      expect(recreatedSessionSegment.state).toBe(segment.state);
      expect(recreatedSessionSegment.startedAt.isSame(segment.startedAt)).toBe(
        true,
      );
      // we stopped segment, so stoppedAt should be the same as in the recreated segment
      expect(
        recreatedSessionSegment.stoppedAt!.isSame(segment.stoppedAt!),
      ).toBe(true);
    });
  });

  describe("stop", () => {
    it("should stop the session segment", () => {
      segment.stop(segment.startedAt.add(1000));

      expect(segment.stoppedAt?.isSame(segment.startedAt.add(1000))).toBe(true);
    });
    it("should throw when stop is called on a stopped segment", () => {
      segment.stop(segment.startedAt.add(1000));

      expect(() => {
        segment.stop(segment.startedAt.add(2000));
      }).toThrow(SegmentAlreadyStoppedError);
    });

    it("should throw when stop is called with a timestamp before startedAt", () => {
      expect(() => {
        segment.stop(segment.startedAt.subtract(1000));
      }).toThrow();
    });

    it("should throw when stop is called with a timestamp equal to startedAt", () => {
      expect(() => {
        segment.stop(segment.startedAt);
      }).toThrow();
    });
  });
  describe("state", () => {
    it("should be active when segment is not stopped", () => {
      expect(segment.state).toBe("active");
    });
    it("should be stopped when segment is stopped", () => {
      segment.stop(segment.startedAt.add(1000));
      expect(segment.state).toBe("stopped");
    });
  });

  describe("adjustStartTime", () => {
    it("should throw when newStartTime is not valid DateTime", () => {
      expect(() => {
        // @ts-expect-error intentionally invalid type
        segment.adjustStartTime(timestamp);
      }).toThrow();

      expect(() => {
        // @ts-expect-error intentionally invalid type
        segment.adjustStartTime(null);
      }).toThrow();

      expect(() => {
        // @ts-expect-error intentionally invalid type
        segment.adjustStartTime(undefined);
      }).toThrow();
    });
    it("should throw when newStartTime is after or equal to stoppedAt", () => {
      segment.stop(segment.startedAt.add(1000));
      expect(() => {
        segment.adjustStartTime(segment.startedAt.add(1000));
      }).toThrow();
    });
    it("should adjust startedAt when newStartTime is before stoppedAt", () => {
      segment.stop(segment.startedAt.add(1000));
      const prevStartedAt = segment.startedAt;
      segment.adjustStartTime(segment.startedAt.subtract(2000));

      expect(segment.startedAt.isSame(prevStartedAt)).toBe(false);

      expect(segment.startedAt.isSame(prevStartedAt.subtract(2000))).toBe(true);
    });
  });

  describe("adjustStopTime", () => {
    it("should throw when newStopTime is not valid DateTime", () => {
      expect(() => {
        // @ts-expect-error intentionally invalid type
        segment.adjustStopTime(timestamp);
      }).toThrow();

      expect(() => {
        // @ts-expect-error intentionally invalid type
        segment.adjustStopTime(null);
      }).toThrow();

      expect(() => {
        // @ts-expect-error intentionally invalid type
        segment.adjustStopTime(undefined);
      }).toThrow();
    });
    it("should throw when newStopTime is before startedAt", () => {
      expect(() => {
        segment.adjustStopTime(segment.startedAt.subtract(1000));
      }).toThrow();
    });
    it("should throw when newStopTime is equal to startedAt", () => {
      expect(() => {
        segment.adjustStopTime(segment.startedAt);
      }).toThrow();
    });
    it("should adjust stoppedAt when newStopTime is after startedAt", () => {
      segment.stop(segment.startedAt.add(1000));
      segment.adjustStopTime(segment.startedAt.add(2000));

      expect(segment.stoppedAt?.isSame(segment.startedAt.add(2000))).toBe(true);
    });
  });

  describe("duration", () => {
    it("should return duration of the stopped segment corectrly", () => {
      segment.stop(segment.startedAt.add(1000));

      expect(segment.durationMs).toBe(1000);
    });
    it("should return duration of the active segment corectrly", () => {
      expect(segment.durationMs).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should handle very short durations (< 1ms) correctly", () => {
      segment.stop(segment.startedAt.add(0.5));
      expect(segment.durationMs).toBe(0.5);
    });

    it("should handle very long durations (days/weeks) correctly", () => {
      segment.stop(segment.startedAt.add(1, "week"));
      expect(segment.durationMs).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it("should throw error when startedAt and stoppedAt are same timestamp", () => {
      expect(() => {
        segment.stop(segment.startedAt);
      }).toThrow();
    });
  });
});
