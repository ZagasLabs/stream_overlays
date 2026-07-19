import { stableHash } from "../hash.js";

export const SSN_ORIGIN = "https://vdo.socialstream.ninja";
export const SSN_SOCKET_URL = "wss://io.socialstream.ninja/extension";

const MAX_FRAME_LENGTH = 128 * 1024;
const MAX_PAYLOADS_PER_FRAME = 50;
const MAX_UNWRAP_DEPTH = 6;
const DEDUPE_WINDOW = 15_000;
const MAX_DEDUPE_ENTRIES = 512;

export class SocialStreamClient extends EventTarget {
  constructor({
    session,
    debug = false,
    label = "dock",
    server = true,
    socketUrl = SSN_SOCKET_URL,
    webSocketFactory
  } = {}) {
    super();
    this.session = session;
    this.debug = debug;
    this.label = cleanLabel(label);
    this.server = server === true;
    this.socketUrl = socketUrl;
    this.webSocketFactory = webSocketFactory || ((url) => new WebSocket(url));
    this.iframe = null;
    this.socket = null;
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    this.running = false;
    this.recentPayloads = new Map();
    this.handleMessage = this.handleMessage.bind(this);
  }

  start() {
    if (!this.session) {
      this.emitStatus("Missing Social Stream Ninja session.", "client", "missing-session");
      return;
    }
    if (this.running) return;
    this.running = true;
    this.iframe = document.createElement("iframe");
    this.iframe.title = "Social Stream Ninja bridge";
    this.iframe.className = "ssn-bridge";
    this.iframe.referrerPolicy = "no-referrer";
    this.iframe.src = buildBridgeUrl(this.session, { label: this.label });
    this.iframe.setAttribute("aria-hidden", "true");
    this.iframe.addEventListener("load", () => this.emitStatus("P2P bridge loaded; waiting for payloads.", "p2p", "loaded"), { once: true });
    this.iframe.addEventListener("error", () => this.emitStatus("P2P bridge failed to load.", "p2p", "error"), { once: true });
    document.body.append(this.iframe);
    window.addEventListener("message", this.handleMessage);
    this.emitStatus("Connecting to Social Stream Ninja P2P.", "p2p", "connecting");
    if (this.server) this.startSocket();
  }

  stop() {
    this.running = false;
    window.removeEventListener("message", this.handleMessage);
    this.iframe?.remove();
    this.iframe = null;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.closeSocket();
    this.recentPayloads.clear();
  }

  handleMessage(event) {
    if (event.origin !== SSN_ORIGIN) return;
    if (this.iframe?.contentWindow && event.source !== this.iframe.contentWindow) return;
    this.emitRaw("p2p", event.data);
    const payloads = extractBridgePayloads(event.data);
    if (!payloads.length) {
      this.emitDiagnostic("p2p", "unsupported-envelope", event.data);
      return;
    }
    payloads.forEach((payload) => this.emitPayload("p2p", payload));
  }

  startSocket() {
    if (!this.running || this.socket) return;
    let socket;
    try {
      socket = this.webSocketFactory(this.socketUrl);
    } catch {
      this.emitStatus("SSN server socket could not be created.", "server", "error");
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    this.emitStatus("Connecting to SSN server channel 4.", "server", "connecting");
    socket.onopen = () => {
      if (socket !== this.socket || !this.running) return;
      this.reconnectAttempt = 0;
      socket.send(JSON.stringify({ join: this.session, out: 3, in: 4 }));
      this.emitStatus("SSN server channel 4 connected.", "server", "connected");
    };
    socket.onmessage = (event) => {
      if (socket !== this.socket || !this.running) return;
      this.emitRaw("server", event.data);
      const decoded = decodeSocketFrame(event.data);
      if (!decoded.valid) {
        this.emitDiagnostic("server", decoded.reason, event.data);
        return;
      }
      if (!decoded.payloads.length) {
        this.emitDiagnostic("server", "unsupported-envelope", decoded.frame);
        return;
      }
      decoded.payloads.forEach((payload) => this.emitPayload("server", payload));
    };
    socket.onerror = () => {
      if (socket === this.socket) this.emitStatus("SSN server socket error; reconnecting.", "server", "error");
    };
    socket.onclose = () => {
      if (socket !== this.socket) return;
      this.socket = null;
      if (this.running) {
        this.emitStatus("SSN server channel closed; reconnecting.", "server", "closed");
        this.scheduleReconnect();
      }
    };
  }

  closeSocket() {
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    try { socket.close(); } catch { /* already closed */ }
  }

  scheduleReconnect() {
    if (!this.running || this.reconnectTimer) return;
    const delay = Math.min(30_000, 1_000 * (2 ** Math.min(this.reconnectAttempt, 5)));
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.startSocket();
    }, delay);
  }

  emitRaw(transport, envelope) {
    if (!this.debug) return;
    this.dispatchEvent(new CustomEvent("raw", { detail: { transport, envelope, timestamp: Date.now() } }));
  }

  emitPayload(transport, payload) {
    if (this.isCrossTransportDuplicate(transport, payload)) {
      this.emitDiagnostic(transport, "cross-transport-duplicate", payload);
      return false;
    }
    this.dispatchEvent(new CustomEvent("payload", { detail: { transport, payload } }));
    this.dispatchEvent(new CustomEvent("message", { detail: payload }));
    return true;
  }

  isCrossTransportDuplicate(transport, payload, now = Date.now()) {
    for (const [key, entry] of this.recentPayloads) {
      if (now - entry.timestamp > DEDUPE_WINDOW) this.recentPayloads.delete(key);
    }
    const key = payloadFingerprint(payload);
    const previous = this.recentPayloads.get(key);
    if (previous && previous.transport !== transport && now - previous.timestamp <= DEDUPE_WINDOW) return true;
    this.recentPayloads.set(key, { transport, timestamp: now });
    while (this.recentPayloads.size > MAX_DEDUPE_ENTRIES) {
      this.recentPayloads.delete(this.recentPayloads.keys().next().value);
    }
    return false;
  }

  emitDiagnostic(transport, reason, envelope) {
    if (!this.debug) return;
    this.dispatchEvent(new CustomEvent("diagnostic", {
      detail: { transport, reason, shape: payloadShape(envelope), timestamp: Date.now() }
    }));
  }

  emitStatus(message, transport = "client", state = "status") {
    if (!this.debug) return;
    this.dispatchEvent(new CustomEvent("status", { detail: { message, transport, state } }));
  }
}

export function extractBridgePayload(data) {
  return extractBridgePayloads(data)[0] ?? null;
}

export function extractBridgePayloads(data) {
  if (!data || typeof data !== "object") return [];
  if (data.dataReceived && Object.hasOwn(data.dataReceived, "overlayNinja")) {
    return flattenPayloads(data.dataReceived.overlayNinja);
  }
  if (Object.hasOwn(data, "overlayNinja")) return flattenPayloads(data.overlayNinja);
  if (data.sendData && Object.hasOwn(data.sendData, "overlayNinja")) {
    return flattenPayloads(data.sendData.overlayNinja);
  }
  return [];
}

export function decodeSocketFrame(value) {
  const frame = parseJsonValue(value);
  if (frame === null) return { valid: false, reason: "invalid-json", frame: null, payloads: [] };
  return { valid: true, reason: "", frame, payloads: flattenPayloads(frame) };
}

export function flattenPayloads(value) {
  const results = [];
  visit(value, 0, results);
  return results;
}

export function buildBridgeUrl(session, { label = "dock" } = {}) {
  const url = new URL(`${SSN_ORIGIN}/`);
  for (const [key, value] of [
    ["ln", ""], ["salt", "vdo.ninja"], ["password", "false"], ["push", ""],
    ["label", cleanLabel(label)], ["view", session], ["vd", "0"], ["ad", "0"],
    ["novideo", ""], ["noaudio", ""], ["autostart", ""], ["cleanoutput", ""],
    ["room", session]
  ]) url.searchParams.set(key, value);
  return url.toString();
}

export function payloadFingerprint(value) {
  return stableHash(stablePayloadText(value));
}

function visit(value, depth, results) {
  if (results.length >= MAX_PAYLOADS_PER_FRAME || depth > MAX_UNWRAP_DEPTH || value === null || value === undefined) return;
  if (typeof value === "string") {
    const parsed = parseJsonValue(value);
    if (parsed !== null) visit(parsed, depth + 1, results);
    return;
  }
  if (Array.isArray(value)) {
    value.slice(0, MAX_PAYLOADS_PER_FRAME).forEach((entry) => visit(entry, depth + 1, results));
    return;
  }
  if (typeof value !== "object") return;

  if (value.dataReceived && Object.hasOwn(value.dataReceived, "overlayNinja")) {
    visit(value.dataReceived.overlayNinja, depth + 1, results);
    return;
  }
  if (Object.hasOwn(value, "overlayNinja")) {
    visit(value.overlayNinja, depth + 1, results);
    return;
  }
  if (value.sendData && Object.hasOwn(value.sendData, "overlayNinja")) {
    visit(value.sendData.overlayNinja, depth + 1, results);
    return;
  }
  if ((value.action === "content" || value.action === "extContent") && value.value !== undefined) {
    visit(value.value, depth + 1, results);
    return;
  }
  if (Array.isArray(value.messages)) {
    visit(value.messages, depth + 1, results);
    return;
  }
  if (value.message && typeof value.message === "object" && !value.chatmessage) {
    visit(value.message, depth + 1, results);
    return;
  }
  if (value.content && typeof value.content === "object" && !value.chatmessage) {
    visit(value.content, depth + 1, results);
    return;
  }
  results.push(value);
}

function parseJsonValue(value) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string" || value.length > MAX_FRAME_LENGTH) return null;
  const text = value.trim();
  if (!text || !["{", "["].includes(text[0])) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function payloadShape(value) {
  if (Array.isArray(value)) return `array(${Math.min(value.length, MAX_PAYLOADS_PER_FRAME)})`;
  if (!value || typeof value !== "object") return typeof value;
  return Object.keys(value).filter((key) => /^[a-zA-Z][\w]{0,39}$/.test(key)).sort().slice(0, 12).join(",") || "empty-object";
}

function stablePayloadText(value, depth = 0, ancestors = new Set()) {
  if (depth > MAX_UNWRAP_DEPTH) return '"[depth]"';
  if (value === null) return "null";
  if (["string", "number", "boolean"].includes(typeof value)) {
    return JSON.stringify(typeof value === "string" ? value.slice(0, MAX_FRAME_LENGTH) : value);
  }
  if (typeof value !== "object") return JSON.stringify(`[${typeof value}]`);
  if (ancestors.has(value)) return '"[circular]"';
  ancestors.add(value);
  let result;
  if (Array.isArray(value)) {
    result = `[${value.slice(0, MAX_PAYLOADS_PER_FRAME).map((entry) => stablePayloadText(entry, depth + 1, ancestors)).join(",")}]`;
  } else {
    const entries = Object.keys(value).sort().slice(0, 80).map((key) =>
      `${JSON.stringify(key)}:${stablePayloadText(value[key], depth + 1, ancestors)}`
    );
    result = `{${entries.join(",")}}`;
  }
  ancestors.delete(value);
  return result;
}

function cleanLabel(value) {
  const label = String(value || "dock").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
  return label || "dock";
}
