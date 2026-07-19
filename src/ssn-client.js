import { SSN_SOCKET_URL, decodeSocketFrame, payloadFingerprint } from "../shared/ssn/client.js";

/* Shared exports remain available for tests and backwards-compatible imports. */
export * from "../shared/ssn/client.js";

const CHAT_SSN_ORIGIN = "https://vdo.socialstream.ninja";

/*
 * The chat intentionally keeps the small P2P receiver semantics from f284ccd.
 * The dock label is retained so current SSN can route to it when other overlays
 * are connected. Channel 4 is an additive fallback, not the primary path.
 */
export class ChatSocialStreamClient extends EventTarget {
  constructor({ session, debug = false, server = true, socketUrl = SSN_SOCKET_URL, webSocketFactory } = {}) {
    super();
    this.session = session;
    this.debug = debug;
    this.server = server === true;
    this.socketUrl = socketUrl;
    this.webSocketFactory = webSocketFactory || ((url) => new WebSocket(url));
    this.iframe = null;
    this.socket = null;
    this.running = false;
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    this.recentPayloads = new Map();
    this.handleMessage = this.handleMessage.bind(this);
  }

  start() {
    if (!this.session) return this.emitStatus("Missing Social Stream Ninja session.");
    if (this.running) return;
    this.running = true;
    this.iframe = document.createElement("iframe");
    this.iframe.title = "Social Stream Ninja chat bridge";
    this.iframe.className = "ssn-bridge";
    this.iframe.referrerPolicy = "no-referrer";
    this.iframe.src = buildChatBridgeUrl(this.session);
    this.iframe.setAttribute("aria-hidden", "true");
    document.body.append(this.iframe);
    window.addEventListener("message", this.handleMessage);
    this.emitStatus("Connecting to Social Stream Ninja chat P2P.");
    if (this.server) this.startSocket();
  }

  stop() {
    this.running = false;
    window.removeEventListener("message", this.handleMessage);
    this.iframe?.remove();
    this.iframe = null;
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.closeSocket();
    this.recentPayloads.clear();
  }

  handleMessage(event) {
    if (event.origin !== CHAT_SSN_ORIGIN) return;
    if (this.iframe?.contentWindow && event.source !== this.iframe.contentWindow) return;
    const payload = event.data?.dataReceived?.overlayNinja ?? event.data?.overlayNinja ?? null;
    this.emitMessage(payload, "p2p");
  }

  startSocket() {
    if (!this.running || this.socket) return;
    let socket;
    try {
      socket = this.webSocketFactory(this.socketUrl);
    } catch {
      this.emitStatus("Chat channel 4 socket could not be created.");
      return this.scheduleReconnect();
    }
    this.socket = socket;
    socket.onopen = () => {
      if (socket !== this.socket || !this.running) return;
      this.reconnectAttempt = 0;
      socket.send(JSON.stringify({ join: this.session, out: 3, in: 4 }));
      this.emitStatus("Chat channel 4 connected.");
    };
    socket.onmessage = (event) => {
      if (socket !== this.socket || !this.running) return;
      const decoded = decodeSocketFrame(event.data);
      if (!decoded.valid) return;
      decoded.payloads.forEach((payload) => this.emitMessage(payload, "server"));
    };
    socket.onerror = () => this.emitStatus("Chat channel 4 socket error; reconnecting.");
    socket.onclose = () => {
      if (socket !== this.socket) return;
      this.socket = null;
      if (this.running) this.scheduleReconnect();
    };
  }

  emitMessage(payload, transport) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
    const now = Date.now();
    for (const [key, entry] of this.recentPayloads) if (now - entry.timestamp > 15_000) this.recentPayloads.delete(key);
    const key = payloadFingerprint(payload);
    const previous = this.recentPayloads.get(key);
    if (previous && previous.transport !== transport && now - previous.timestamp <= 15_000) return false;
    this.recentPayloads.set(key, { transport, timestamp: now });
    while (this.recentPayloads.size > 512) this.recentPayloads.delete(this.recentPayloads.keys().next().value);
    this.dispatchEvent(new CustomEvent("message", { detail: payload }));
    return true;
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

  emitStatus(message) {
    if (this.debug) this.dispatchEvent(new CustomEvent("status", { detail: { message } }));
  }
}

export function buildChatBridgeUrl(session) {
  const url = new URL(`${CHAT_SSN_ORIGIN}/`);
  for (const [key, value] of [
    ["ln", ""], ["salt", "vdo.ninja"], ["password", "false"], ["push", "false"],
    ["label", "dock"], ["vd", "0"], ["ad", "0"], ["autostart", ""], ["cleanoutput", ""],
    ["view", session], ["room", session]
  ]) url.searchParams.set(key, value);
  return url.toString();
}
