import test from "node:test";
import assert from "node:assert/strict";
import { AlertQueue } from "../src/queue.js";

const alert = (id, priority) => ({ id, priority, type: "follow" });

test("orders waiting alerts by priority and preserves FIFO within a tier", () => {
  const queue = new AlertQueue();
  queue.enqueue(alert("minor-a", 10), 0);
  queue.enqueue(alert("minor-b", 10), 1);
  queue.enqueue(alert("major", 30), 2);
  assert.equal(queue.dequeue().id, "major");
  assert.equal(queue.dequeue().id, "minor-a");
  assert.equal(queue.dequeue().id, "minor-b");
});

test("bounds bursts and keeps higher priority arrivals", () => {
  const queue = new AlertQueue({ maxSize: 2 });
  queue.enqueue(alert("a", 10), 0);
  queue.enqueue(alert("b", 20), 1);
  const result = queue.enqueue(alert("c", 30), 2);
  assert.equal(result.dropped.id, "a");
  assert.deepEqual([queue.dequeue().id, queue.dequeue().id], ["c", "b"]);
});

test("suppresses replayed IDs inside the dedupe window", () => {
  const queue = new AlertQueue({ dedupeWindow: 100 });
  assert.equal(queue.enqueue(alert("same", 10), 0).accepted, true);
  queue.dequeue();
  assert.equal(queue.enqueue(alert("same", 10), 50).reason, "duplicate");
  assert.equal(queue.enqueue(alert("same", 10), 101).accepted, true);
});
