import { parseConfigFromLocation } from "./config.js";
import { LayoutManager } from "./layout-manager.js";
import { normalizeIncoming, summarizePayloadShape } from "./message-normalizer.js";
import { renderMessage } from "./message-renderer.js";
import { SocialStreamClient } from "./ssn-client.js";

const config = parseConfigFromLocation(window.location);
const overlay = document.querySelector("#overlay");
const column = document.querySelector("#chat-column");
const debugPanel = document.querySelector("#debug-panel");
let client = null;
const layout = new LayoutManager({
  container: column,
  max: config.max,
  duration: config.duration,
  eventDuration: config.eventDuration,
  reduceMotion: config.reduceMotion
});

document.documentElement.dataset.side = config.side;
document.documentElement.dataset.debug = config.debug ? "1" : "0";
document.documentElement.dataset.reduceMotion = config.reduceMotion ? "1" : "0";
document.documentElement.style.setProperty("--accent", config.accent);
document.documentElement.style.setProperty("--overlay-scale", String(config.scale));
document.documentElement.style.setProperty("--chat-viewport-height", `${config.max * 172 + 68}px`);

if (!config.valid) {
  showDebug("Missing #session=SESSION_ID. Use #mock=1 for local testing.", true);
} else if (config.mock) {
  startMockMode();
} else {
  client = new SocialStreamClient({ session: config.session, debug: config.debug, label: "chat" });
  client.addEventListener("message", (event) => ingest(event.detail));
  client.addEventListener("status", (event) => showDebug(event.detail.message));
  client.start();
}

window.addEventListener("pagehide", () => client?.stop(), { once: true });

function ingest(raw) {
  const message = normalizeIncoming(raw);
  if (!message) {
    showDebug(`Ignored payload (${summarizePayloadShape(raw)}).`);
    return;
  }
  layout.add(message, renderMessage(message, config));
  updateDebugStats();
}

async function startMockMode() {
  showDebug("Mock mode active.");
  const fixtures = await loadFixtures();
  buildDebugControls(fixtures);
  let index = 0;
  const addNext = () => {
    ingest({ ...fixtures[index % fixtures.length], id: `${fixtures[index % fixtures.length].id || "fixture"}-${Date.now()}-${index}` });
    index += 1;
  };
  fixtures.forEach((fixture, fixtureIndex) => {
    window.setTimeout(() => ingest({ ...fixture, id: `${fixture.id || "fixture"}-${fixtureIndex}` }), fixtureIndex * 500);
  });
  window.setInterval(addNext, 4200);
}

async function loadFixtures() {
  const files = [
    "normal-message",
    "long-message",
    "moderator-message",
    "follow-event",
    "subscription-event",
    "donation-event",
    "raid-event"
  ];
  return Promise.all(files.map(async (file) => {
    const response = await fetch(`./fixtures/${file}.json`, { cache: "no-store" });
    return response.json();
  }));
}

function buildDebugControls(fixtures) {
  if (!config.debug) return;
  debugPanel.hidden = false;
  debugPanel.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = "Debug";
  debugPanel.append(title);
  fixtures.forEach((fixture) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = fixture.fixtureName || fixture.type || "Message";
    button.addEventListener("click", () => ingest({ ...fixture, id: `${fixture.id || "fixture"}-${Date.now()}` }));
    debugPanel.append(button);
  });
  const stats = document.createElement("span");
  stats.id = "debug-stats";
  debugPanel.append(stats);
  updateDebugStats();
}

function updateDebugStats() {
  if (!config.debug) return;
  const stats = document.querySelector("#debug-stats");
  if (stats) stats.textContent = `${layout.snapshot().length}/${config.max} visible`;
}

function showDebug(message, force = false) {
  if (!config.debug && !force) return;
  debugPanel.hidden = false;
  overlay.classList.add("has-debug");
  const line = document.createElement("p");
  line.textContent = message;
  debugPanel.append(line);
}
