export class AlertQueue {
  constructor({ maxSize = 30, dedupeWindow = 300_000 } = {}) {
    this.maxSize = maxSize;
    this.dedupeWindow = dedupeWindow;
    this.items = [];
    this.seen = new Map();
    this.sequence = 0;
  }

  enqueue(alert, now = Date.now()) {
    this.pruneSeen(now);
    if (this.seen.has(alert.id)) return { accepted: false, reason: "duplicate" };
    const queued = { ...alert, _sequence: this.sequence++ };
    this.seen.set(alert.id, now);
    this.items.push(queued);
    this.items.sort((a, b) => b.priority - a.priority || a._sequence - b._sequence);
    if (this.items.length > this.maxSize) {
      const dropped = this.items.pop();
      if (dropped.id === alert.id) return { accepted: false, reason: "queue-full", dropped };
      return { accepted: true, dropped };
    }
    return { accepted: true };
  }

  dequeue() {
    const item = this.items.shift();
    if (!item) return null;
    const { _sequence, ...alert } = item;
    return alert;
  }

  get length() { return this.items.length; }

  clear() { this.items.length = 0; }

  pruneSeen(now) {
    for (const [id, seenAt] of this.seen) if (now - seenAt > this.dedupeWindow) this.seen.delete(id);
  }
}
