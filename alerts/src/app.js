import { platformPresentation } from "../../shared/platform.js";
import { SocialStreamClient } from "../../shared/ssn/client.js";
import { AlertAudioEngine } from "./audio-engine.js";
import { parseAlertsConfigFromLocation } from "./config.js";
import { ALERT_FIXTURES, STREAMPLACE_MOCK_ALERT } from "./mock-fixtures.js";
import { alertDuration, normalizeAlert } from "./normalizer.js";
import { AlertQueue } from "./queue.js";

const config = parseAlertsConfigFromLocation(window.location);
const stage = document.querySelector("#stage");
const debugPanel = document.querySelector("#debug-panel");
const diagnostic = document.querySelector("#diagnostic");
const queue = new AlertQueue({ maxSize: config.maxQueue });
const audio = new AlertAudioEngine(config);
const timers = new Set();
let active = null;
let fixtureCounter = 0;

document.documentElement.dataset.position = config.position;
document.documentElement.dataset.side = config.side;
document.documentElement.dataset.reduceMotion = config.reduceMotion ? "1" : "0";
document.documentElement.style.setProperty("--overlay-accent", config.accent);
document.documentElement.style.setProperty("--alert-scale", String(config.scale));
audio.prepare();
await audio.whenReady();

if (!config.valid) {
  showDiagnostic("Missing #session=SESSION_ID. Use #mock=1 for local testing.", true);
} else if (config.mock) {
  startMockMode();
} else {
  const client = new SocialStreamClient({ session: config.session, debug: config.debug });
  client.addEventListener("message", (event) => ingest(event.detail));
  client.addEventListener("status", (event) => showDiagnostic(event.detail.message));
  client.start();
}

window.addEventListener("pagehide", () => {
  timers.forEach((timer) => window.clearTimeout(timer));
  timers.clear();
  audio.destroy();
}, { once: true });

function ingest(payload) {
  const alert = normalizeAlert(payload, config);
  if (!alert) return showDiagnostic(`Ignored unsupported/unknown event (${safeShape(payload)}).`);
  enqueue(alert);
}

function enqueue(alert) {
  const outcome = queue.enqueue(alert);
  if (!outcome.accepted) return showDiagnostic(outcome.reason === "duplicate" ? "Duplicate alert suppressed." : "Alert queue is full.");
  if (outcome.dropped) showDiagnostic(`Queue bounded: dropped ${outcome.dropped.type}.`);
  updateDebugStatus();
  pump();
}

function pump() {
  if (active) return;
  const alert = queue.dequeue();
  if (!alert) return updateDebugStatus();
  active = alert;
  const card = renderAlert(alert);
  stage.replaceChildren(card);
  requestAnimationFrame(() => {
    card.classList.add("is-visible", "is-glitch-enter");
    schedule(() => card.classList.remove("is-glitch-enter"), 620);
  });
  scheduleAlertGlitches(card, alert);
  audio.play(alert.tier, alert.type);
  updateDebugStatus();
  schedule(() => {
    card.classList.add("is-leaving");
    schedule(() => {
      card.remove();
      active = null;
      updateDebugStatus();
      pump();
    }, config.reduceMotion ? 20 : 520);
  }, alertDuration(alert, config));
}

function renderAlert(alert) {
  const article = document.createElement("article");
  article.className = `alert-card alert-card--${alert.tier}`;
  article.dataset.type = alert.type;
  article.dataset.platform = platformPresentation(alert.platform).type;
  article.dataset.tier = alert.tier;
  article.setAttribute("role", "status");
  article.setAttribute("aria-label", `${labelFor(alert)} from ${alert.user}`);
  const rail = document.createElement("div");
  rail.className = "alert-rail";
  if (config.showAvatar) rail.append(renderAvatar(alert));
  const copy = document.createElement("div");
  copy.className = "alert-copy";
  const meta = document.createElement("div");
  meta.className = "alert-meta";
  if (config.showPlatform) {
    const platform = document.createElement("span");
    platform.className = "platform-chip";
    platform.textContent = `${platformPresentation(alert.platform).glyph} · ${platformPresentation(alert.platform).label}`;
    platform.dataset.glitch = platform.textContent;
    meta.append(platform);
  }
  const label = document.createElement("span");
  label.className = "alert-label";
  label.textContent = labelFor(alert);
  meta.append(label);
  copy.append(meta);
  const user = document.createElement("strong");
  user.className = "alert-user";
  user.textContent = alert.user;
  user.dataset.glitch = user.textContent;
  copy.append(user);
  const emphasis = emphasisFor(alert);
  if (emphasis) {
    const value = document.createElement("span");
    value.className = "alert-value";
    value.textContent = emphasis;
    value.dataset.glitch = value.textContent;
    copy.append(value);
  }
  if (alert.message) {
    const message = document.createElement("p");
    message.className = "alert-message";
    message.textContent = alert.message;
    copy.append(message);
  }
  rail.append(copy);
  article.append(rail);
  const edgeScar = document.createElement("span");
  edgeScar.className = "alert-edge-scar";
  edgeScar.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 3; index += 1) edgeScar.append(document.createElement("i"));
  article.append(edgeScar);
  return article;
}

function renderAvatar(alert) {
  const shell = document.createElement("div");
  shell.className = "alert-avatar";
  if (alert.avatar) {
    const image = document.createElement("img");
    image.src = alert.avatar;
    image.alt = "";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => shell.replaceChildren(avatarFallback(alert.user)), { once: true });
    shell.append(image);
  } else shell.append(avatarFallback(alert.user));
  return shell;
}

function avatarFallback(user) {
  const fallback = document.createElement("span");
  fallback.className = "avatar-fallback";
  fallback.textContent = [...user][0]?.toUpperCase() || "•";
  return fallback;
}

function labelFor(alert) {
  return ({ follow: "NEW FOLLOW", subscription: "NEW SUB", resubscription: "RESUB", membership: "NEW MEMBER", gift: "COMMUNITY GIFT", raid: "INCOMING RAID", donation: "SUPPORT", bits: "BITS", superchat: "SUPER CHAT", milestone: "MILESTONE", "generic-event": "STREAM EVENT" })[alert.type] || "STREAM EVENT";
}

function emphasisFor(alert) {
  if (alert.amount) return alert.currency && !alert.amount.toUpperCase().includes(alert.currency) ? `${alert.amount} ${alert.currency}` : alert.amount;
  if (alert.count) return `${alert.count.toLocaleString()} ${alert.type === "raid" ? "VIEWERS" : "GIFTS"}`;
  return "";
}

function schedule(callback, delay) {
  const timer = window.setTimeout(() => { timers.delete(timer); callback(); }, delay);
  timers.add(timer);
}

function scheduleAlertGlitches(card, alert) {
  if (config.reduceMotion) return;
  const moments = alert.tier === "major" ? [1450, 4650] : alert.tier === "standard" ? [1850] : [2350];
  for (const delay of moments) schedule(() => triggerAlertGlitch(card), delay);
}

function triggerAlertGlitch(card) {
  if (!card.isConnected || card.classList.contains("is-leaving")) return;
  card.classList.add("is-glitching");
  schedule(() => card.classList.remove("is-glitching"), 360);
}

function showDiagnostic(message, force = false) {
  if (!config.debug && !force) return;
  diagnostic.hidden = false;
  diagnostic.textContent = message;
  updateDebugStatus();
}

function safeShape(payload) {
  if (!payload || typeof payload !== "object") return "non-object";
  return Object.keys(payload).filter((key) => /^[a-zA-Z][\w]{0,39}$/.test(key)).sort().slice(0, 12).join(", ") || "empty";
}

function startMockMode() {
  buildDebugControls();
  showDiagnostic(`Mock mode · audio ${audio.status}.`);
  injectFixture(ALERT_FIXTURES[0]);
  schedule(() => injectFixture(ALERT_FIXTURES[3]), 700);
  schedule(() => injectFixture(ALERT_FIXTURES[6]), 1050);
}

function buildDebugControls() {
  debugPanel.hidden = false;
  const title = document.createElement("strong");
  title.textContent = "ALERTS LAB";
  debugPanel.append(title);
  ALERT_FIXTURES.forEach((fixture, index) => addButton(`${index < 9 ? `${index + 1} · ` : ""}${fixture.fixtureName}`, () => injectFixture(fixture)));
  addButton("Streamplace mock only", () => enqueue({ ...STREAMPLACE_MOCK_ALERT, id: `${STREAMPLACE_MOCK_ALERT.id}-${fixtureCounter++}`, timestamp: Date.now() }));
  addButton("Burst + priority", demoBurst);
  addButton("Duplicate suppression", demoDuplicate);
  addButton("Glitch active alert", () => {
    const card = stage.querySelector(".alert-card");
    if (card) triggerAlertGlitch(card);
  });
  addButton("Enable / test audio", async () => { const status = await audio.enable(); audio.play("standard"); showDiagnostic(`Audio: ${status}.`); });
  addButton("Mute / unmute", () => { audio.setEnabled(audio.enabled === false); showDiagnostic(`Audio ${audio.enabled ? "enabled" : "muted"}.`); });
  const volumeLabel = document.createElement("label");
  volumeLabel.textContent = "Master volume";
  const volume = document.createElement("input");
  volume.type = "range"; volume.min = "0"; volume.max = ".65"; volume.step = ".01"; volume.value = String(config.volume);
  volume.setAttribute("aria-label", "Alert master volume");
  volume.addEventListener("input", () => { audio.setMasterVolume(volume.value); updateDebugStatus(); });
  volumeLabel.append(volume);
  debugPanel.append(volumeLabel);
  const status = document.createElement("span");
  status.id = "debug-status";
  debugPanel.append(status);
  updateDebugStatus();
  window.addEventListener("keydown", (event) => {
    if (!event.altKey) return;
    const index = Number(event.key) - 1;
    if (ALERT_FIXTURES[index]) { event.preventDefault(); injectFixture(ALERT_FIXTURES[index]); }
  });
}

function addButton(label, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-label", `Run alert fixture: ${label}`);
  button.addEventListener("click", handler);
  debugPanel.append(button);
}

function injectFixture(fixture, preserveId = false) {
  const payload = { ...fixture.payload, id: preserveId ? fixture.payload.id : `${fixture.payload.id}-${fixtureCounter++}`, timestamp: Date.now() };
  ingest(payload);
}

function demoBurst() {
  [ALERT_FIXTURES[0], ALERT_FIXTURES[1], ALERT_FIXTURES[3], ALERT_FIXTURES[6], ALERT_FIXTURES[5]].forEach(injectFixture);
  showDiagnostic("Burst queued; major items moved ahead of waiting minor items.");
}

function demoDuplicate() {
  const fixture = ALERT_FIXTURES[0];
  injectFixture(fixture, true);
  injectFixture(fixture, true);
}

function updateDebugStatus() {
  const status = document.querySelector("#debug-status");
  if (status) status.textContent = `active: ${active?.type || "none"} · queued: ${queue.length} · audio: ${audio.status} (${audio.packStatus}) · volume: ${audio.masterVolume.toFixed(2)}`;
}
