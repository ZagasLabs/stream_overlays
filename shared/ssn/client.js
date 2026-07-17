export const SSN_ORIGIN = "https://vdo.socialstream.ninja";

export class SocialStreamClient extends EventTarget {
  constructor({ session, debug = false } = {}) {
    super();
    this.session = session;
    this.debug = debug;
    this.iframe = null;
    this.handleMessage = this.handleMessage.bind(this);
  }

  start() {
    if (!this.session) return this.emitStatus("Missing Social Stream Ninja session.");
    this.iframe = document.createElement("iframe");
    this.iframe.title = "Social Stream Ninja bridge";
    this.iframe.className = "ssn-bridge";
    this.iframe.referrerPolicy = "no-referrer";
    this.iframe.src = buildBridgeUrl(this.session);
    this.iframe.setAttribute("aria-hidden", "true");
    document.body.append(this.iframe);
    window.addEventListener("message", this.handleMessage);
    this.emitStatus("Connecting to Social Stream Ninja.");
  }

  stop() {
    window.removeEventListener("message", this.handleMessage);
    this.iframe?.remove();
    this.iframe = null;
  }

  handleMessage(event) {
    if (event.origin !== SSN_ORIGIN) return;
    if (this.iframe?.contentWindow && event.source !== this.iframe.contentWindow) return;
    const payload = extractBridgePayload(event.data);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
    this.dispatchEvent(new CustomEvent("message", { detail: payload }));
  }

  emitStatus(message) {
    if (this.debug) this.dispatchEvent(new CustomEvent("status", { detail: { message } }));
  }
}

export function extractBridgePayload(data) {
  return data?.dataReceived?.overlayNinja ?? data?.overlayNinja ?? null;
}

export function buildBridgeUrl(session) {
  const url = new URL(`${SSN_ORIGIN}/`);
  for (const [key, value] of [
    ["ln", ""], ["salt", "vdo.ninja"], ["password", "false"], ["push", "false"],
    ["vd", "0"], ["ad", "0"], ["autostart", ""], ["cleanoutput", ""],
    ["view", session], ["room", session]
  ]) url.searchParams.set(key, value);
  return url.toString();
}
