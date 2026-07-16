const SSN_ORIGIN = "https://vdo.socialstream.ninja";

export class SocialStreamClient extends EventTarget {
  constructor({ session, debug = false } = {}) {
    super();
    this.session = session;
    this.debug = debug;
    this.iframe = null;
    this.handleMessage = this.handleMessage.bind(this);
  }

  start() {
    if (!this.session) {
      this.emitStatus("Missing Social Stream Ninja session.");
      return;
    }

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
    if (!payload || typeof payload !== "object") return;
    this.dispatchEvent(new CustomEvent("message", { detail: payload }));
  }

  emitStatus(message) {
    if (!this.debug) return;
    this.dispatchEvent(new CustomEvent("status", { detail: { message } }));
  }
}

export function extractBridgePayload(data) {
  return data?.dataReceived?.overlayNinja ?? data?.overlayNinja ?? null;
}

export function buildBridgeUrl(session) {
  const url = new URL(`${SSN_ORIGIN}/`);
  url.searchParams.set("ln", "");
  url.searchParams.set("salt", "vdo.ninja");
  url.searchParams.set("password", "false");
  url.searchParams.set("push", "false");
  url.searchParams.set("vd", "0");
  url.searchParams.set("ad", "0");
  url.searchParams.set("autostart", "");
  url.searchParams.set("cleanoutput", "");
  url.searchParams.set("view", session);
  url.searchParams.set("room", session);
  return url.toString();
}
