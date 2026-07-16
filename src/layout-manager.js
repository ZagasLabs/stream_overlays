import { stableHash } from "./message-normalizer.js";

const MESSAGE_VARIANTS = [
  { name: "slash-left", rotation: -1.3, offset: 0, flip: false },
  { name: "slash-right", rotation: 1.1, offset: 34, flip: true },
  { name: "portrait-cut-left", rotation: -0.6, offset: 20, flip: false },
  { name: "portrait-cut-right", rotation: 1.4, offset: 52, flip: true }
];

const EVENT_VARIANTS = [
  { name: "event-needle", rotation: -0.6, offset: 16, flip: false },
  { name: "event-bolt", rotation: 0.8, offset: 42, flip: true }
];

const OFFSCREEN_BUFFER = 4;
const REFLOW_SETTLE_MS = 520;

export function selectLayoutVariant(message, index = 0) {
  const list = message.kind === "event" || message.kind === "major-event" || message.kind === "donation" ? EVENT_VARIANTS : MESSAGE_VARIANTS;
  const seed = numericSeed(message.id || stableHash(JSON.stringify(message)) || index);
  return list[(seed + index) % list.length];
}

export function chooseEvictionIndex(messages) {
  return messages.length > 0 ? 0 : -1;
}

export function shouldCleanupOffscreen({ bottom, viewportTop, expired = false, itemCount = 0, max = 6, buffer = OFFSCREEN_BUFFER } = {}) {
  const offscreen = Number.isFinite(bottom) && Number.isFinite(viewportTop) && bottom <= viewportTop + 1;
  const beyondVisibleLimit = itemCount > max;
  const beyondHardLimit = itemCount > max + buffer;
  return beyondHardLimit || (offscreen && (expired || beyondVisibleLimit));
}

export class LayoutManager {
  constructor({ container, max = 6, duration = 18000, eventDuration = 26000, reduceMotion = false } = {}) {
    this.container = container;
    this.max = max;
    this.duration = duration;
    this.eventDuration = eventDuration;
    this.reduceMotion = reduceMotion;
    this.items = [];
    this.cleanupTimer = null;
    this.resizeObserver = null;

    if (typeof ResizeObserver === "function" && this.container) {
      this.resizeObserver = new ResizeObserver(() => this.scheduleCleanup());
      this.resizeObserver.observe(this.container);
    }
  }

  add(message, element) {
    const previousPositions = this.capturePositions();
    const variant = selectLayoutVariant(message, this.items.length);
    const duration = isLongLived(message) ? this.eventDuration : this.duration;
    const item = {
      message,
      element,
      variant,
      createdAt: Date.now(),
      duration,
      expired: false,
      timer: null
    };

    this.items.push(item);
    this.container.append(element);
    this.resizeObserver?.observe(element);
    this.applyElementState(item, this.items.length - 1);
    requestAnimationFrameSafe(() => element.classList.add("is-entered"), this.reduceMotion);

    item.timer = setTimeout(() => {
      item.expired = true;
      this.scheduleCleanup();
    }, duration);

    this.reflow();
    this.animateReflow(previousPositions);
    this.scheduleCleanup(REFLOW_SETTLE_MS);
  }

  removeById(id) {
    const index = this.items.findIndex((item) => item.message.id === id);
    if (index >= 0) this.discardAt(index);
  }

  discardAt(index) {
    const [item] = this.items.splice(index, 1);
    if (!item) return;
    clearTimeout(item.timer);
    this.resizeObserver?.unobserve(item.element);
    item.element.remove();
    this.reflow();
  }

  scheduleCleanup(delay = 0) {
    clearTimeout(this.cleanupTimer);
    this.cleanupTimer = setTimeout(() => {
      this.cleanupTimer = null;
      this.cleanupOffscreen();
    }, Math.max(0, delay));
  }

  cleanupOffscreen() {
    if (!this.container || this.items.length === 0) return;
    const viewportTop = this.container.getBoundingClientRect?.().top;
    if (!Number.isFinite(viewportTop)) return;

    while (this.items.length > 0) {
      const oldest = this.items[0];
      const bottom = oldest.element.getBoundingClientRect?.().bottom;
      if (!shouldCleanupOffscreen({
        bottom,
        viewportTop,
        expired: oldest.expired,
        itemCount: this.items.length,
        max: this.max
      })) break;
      this.discardAt(chooseEvictionIndex(this.items.map((item) => item.message)));
    }
  }

  reflow() {
    this.items.forEach((item, index) => this.applyElementState(item, index));
  }

  applyElementState(item, index) {
    item.element.style.setProperty("--slot-index", String(index));
    item.element.style.setProperty("--slot-offset", `${item.variant.offset}px`);
    item.element.style.setProperty("--card-rotate", `${item.variant.rotation}deg`);
    item.element.dataset.variant = item.variant.name;
    item.element.dataset.slot = String(index + 1);
  }

  capturePositions() {
    return new Map(this.items.map((item) => [item.message.id, item.element.getBoundingClientRect?.().top]));
  }

  animateReflow(previousPositions) {
    if (this.reduceMotion || previousPositions.size === 0) return;
    const moving = [];

    for (const item of this.items) {
      const previousTop = previousPositions.get(item.message.id);
      const currentTop = item.element.getBoundingClientRect?.().top;
      if (!Number.isFinite(previousTop) || !Number.isFinite(currentTop)) continue;
      const delta = previousTop - currentTop;
      if (Math.abs(delta) < 0.5) continue;
      moving.push({ element: item.element, delta });
    }

    if (moving.length === 0) return;
    for (const { element, delta } of moving) {
      element.classList.add("is-reflowing");
      element.style.setProperty("--reflow-y", `${delta}px`);
    }

    void this.container.offsetHeight;
    requestAnimationFrameSafe(() => {
      for (const { element } of moving) {
        element.classList.remove("is-reflowing");
        element.style.setProperty("--reflow-y", "0px");
      }
    });
  }

  snapshot() {
    if (!this.container?.getBoundingClientRect) return this.items.map((item) => item.message.id);
    const viewport = this.container.getBoundingClientRect();
    return this.items
      .filter((item) => {
        const rect = item.element.getBoundingClientRect?.();
        return rect && rect.bottom > viewport.top && rect.top < viewport.bottom;
      })
      .map((item) => item.message.id);
  }
}

function isLongLived(message) {
  return message.kind === "event" || message.kind === "major-event" || message.kind === "donation";
}

function numericSeed(value) {
  return [...String(value)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function requestAnimationFrameSafe(callback, immediate = false) {
  if (immediate || typeof requestAnimationFrame !== "function") callback();
  else requestAnimationFrame(callback);
}
