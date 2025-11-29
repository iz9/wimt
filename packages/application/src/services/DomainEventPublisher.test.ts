 
import { DomainEvent } from "@wimt/domain/events";
import { DateTime } from "@wimt/domain/valueObjects";

import { DomainEventPublisher } from "./DomainEventPublisher";

// Test event classes
class TestEvent1 extends DomainEvent {
  readonly type = "TestEvent1";

  constructor(
    public readonly data: string,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}

class TestEvent2 extends DomainEvent {
  readonly type = "TestEvent2";

  constructor(
    public readonly value: number,
    occurredAt: DateTime,
  ) {
    super(occurredAt);
  }
}

describe("DomainEventPublisher", () => {
  let publisher: DomainEventPublisher;

  beforeEach(() => {
    publisher = new DomainEventPublisher();
  });

  afterEach(() => {
    publisher.clearHandlers();
  });

  describe("subscribe and publish", () => {
    it("should execute handler when event is published", async () => {
      const handler = jest.fn();

      publisher.subscribe(TestEvent1, handler);

      const event = new TestEvent1("test data", DateTime.create(Date.now()));

      await publisher.publish(event);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it("should execute multiple handlers for same event class", async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      publisher.subscribe(TestEvent1, handler1);
      publisher.subscribe(TestEvent1, handler2);
      publisher.subscribe(TestEvent1, handler3);

      const event = new TestEvent1("test", DateTime.create(Date.now()));

      await publisher.publish(event);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    it("should execute handlers sequentially in registration order", async () => {
      const executionOrder: number[] = [];

      const handler1 = jest.fn(async () => {
        executionOrder.push(1);
      });

      const handler2 = jest.fn(async () => {
        executionOrder.push(2);
      });

      const handler3 = jest.fn(async () => {
        executionOrder.push(3);
      });

      publisher.subscribe(TestEvent1, handler1);
      publisher.subscribe(TestEvent1, handler2);
      publisher.subscribe(TestEvent1, handler3);

      const event = new TestEvent1("test", DateTime.create(Date.now()));

      await publisher.publish(event);

      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it("should only execute handlers for matching event class", async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      publisher.subscribe(TestEvent1, handler1);
      publisher.subscribe(TestEvent2, handler2);

      const event1 = new TestEvent1("test", DateTime.create(Date.now()));

      await publisher.publish(event1);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).not.toHaveBeenCalled();
    });

    it("should handle events with no registered handlers", async () => {
      const event = new TestEvent1("test", DateTime.create(Date.now()));

      await expect(publisher.publish(event)).resolves.not.toThrow();
    });
  });

  describe("publishAll", () => {
    it("should publish multiple events sequentially", async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      publisher.subscribe(TestEvent1, handler1);
      publisher.subscribe(TestEvent2, handler2);

      const events = [
        new TestEvent1("first", DateTime.create(Date.now())),
        new TestEvent2(42, DateTime.create(Date.now())),
        new TestEvent1("second", DateTime.create(Date.now())),
      ];

      await publisher.publishAll(events);

      expect(handler1).toHaveBeenCalledTimes(2);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe("clearHandlers", () => {
    it("should remove all registered handlers", async () => {
      const handler = jest.fn();

      publisher.subscribe(TestEvent1, handler);

      publisher.clearHandlers();

      const event = new TestEvent1("test", DateTime.create(Date.now()));

      await publisher.publish(event);

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
