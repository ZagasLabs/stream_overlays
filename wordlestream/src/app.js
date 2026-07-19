import { platformPresentation } from "../../shared/platform.js";
import { SocialStreamClient } from "../../shared/ssn/client.js";
import { parseWordleConfigFromLocation } from "./config.js";
import { getDictionary } from "./dictionary.js";
import { CooperativeWordGame } from "./game.js";
import { normalizeSubmission } from "./input.js";
import { loadGame, saveGame, storageKey } from "./persistence.js";

let config = parseWordleConfigFromLocation(window.location);
let game = createGame(config.lang);
let latestAttemptCount = game.attempts.length;
let audioContext = null;
let instabilityTimer = null;
let glitchTimer = null;
let client = null;

const board = document.querySelector("#board");
const stateLabel = document.querySelector("#round-state");
const prompt = document.querySelector("#prompt");
const participation = document.querySelector("#participation");
const result = document.querySelector("#result");
const diagnostic = document.querySelector("#diagnostic");
const debugPanel = document.querySelector("#debug-panel");
const gamePanel = document.querySelector(".game-panel");

document.documentElement.style.setProperty("--overlay-accent", config.accent);
document.documentElement.style.setProperty("--wordle-scale", String(config.scale));
document.documentElement.dataset.reduceMotion = config.reduceMotion ? "1" : "0";
render();
scheduleInstability();

if (!config.valid) {
  showDiagnostic("Missing #session=SESSION_ID. Use #mock=1 for local testing.", true);
} else if (config.mock) {
  startMockMode();
} else {
  // Guesses are ordinary chat payloads, which SSN routes to the dock label.
  client = new SocialStreamClient({ session: config.session, debug: config.debug, label: "dock" });
  client.addEventListener("message", (event) => ingest(event.detail));
  client.addEventListener("status", (event) => showDiagnostic(event.detail.message));
  client.start();
}

const queueTimer = window.setInterval(() => {
  const accepted = game.processNext();
  if (accepted) {
    persist();
    render();
    playSound(game.status === "won" ? "win" : "accepted");
  }
}, 200);
window.addEventListener("pagehide", () => {
  client?.stop();
  window.clearInterval(queueTimer);
  window.clearTimeout(instabilityTimer);
  window.clearTimeout(glitchTimer);
}, { once: true });

function createGame(language, answer) {
  const dictionary = getDictionary(language, config.wordLength, config.accents);
  const instance = new CooperativeWordGame({ ...dictionary, ...config, answer });
  if (!config.mock) instance.restore(loadGame(window.localStorage, storageKey(language, config.wordLength)));
  return instance;
}

function ingest(payload) {
  const submission = normalizeSubmission(payload, config);
  if (!submission) return;
  if (submission.kind === "admin") {
    if (!submission.authorized) return showDiagnostic("Ignored unauthorized admin command.");
    if (game.control(submission.action)) {
      showDiagnostic(`Admin: ${submission.action}.`);
      persist();
      render();
    }
    return;
  }
  const outcome = game.submit(submission);
  if (!outcome.accepted) return showDiagnostic(reasonText(outcome));
  showDiagnostic(`${submission.displayName} queued ${submission.guess.toUpperCase()}.`);
  const accepted = game.processNext();
  persist();
  render();
  if (accepted) playSound(game.status === "won" ? "win" : "accepted");
}

function render() {
  const animateIndex = game.attempts.length > latestAttemptCount ? game.attempts.length - 1 : -1;
  board.style.setProperty("--word-length", String(game.wordLength));
  board.replaceChildren();
  for (let rowIndex = 0; rowIndex < game.maxAttempts; rowIndex += 1) {
    const attempt = game.attempts[rowIndex];
    const row = document.createElement("div");
    row.className = "board-row";
    row.setAttribute("role", "row");
    if (rowIndex === animateIndex && !config.reduceMotion) row.classList.add("is-revealing");
    const tiles = document.createElement("div");
    tiles.className = "tiles";
    for (let column = 0; column < game.wordLength; column += 1) {
      const tile = document.createElement("span");
      tile.className = `tile${attempt ? ` tile--${attempt.score[column]}` : ""}`;
      tile.style.setProperty("--tile-index", String(column));
      tile.textContent = attempt ? [...attempt.word.toUpperCase()][column] : "";
      if (tile.textContent) tile.dataset.glitch = tile.textContent;
      tile.setAttribute("role", "gridcell");
      tiles.append(tile);
    }
    row.append(tiles);
    if (config.showParticipant) row.append(participantFor(attempt));
    board.append(row);
  }
  latestAttemptCount = game.attempts.length;
  const stateText = { active: "LIVE", paused: "PAUSED", won: "SOLVED", lost: "ROUND OVER", revealed: "REVEALED" }[game.status];
  stateLabel.textContent = stateText;
  stateLabel.dataset.state = game.status;
  prompt.textContent = `${config.lang.toUpperCase()} · SEND ${config.commands.join(" or ").toUpperCase()} + ${game.wordLength}-LETTER WORD`;
  participation.textContent = `${game.participants.size} PLAYER${game.participants.size === 1 ? "" : "S"} · ${game.queue.length} QUEUED`;
  const ended = ["won", "lost", "revealed"].includes(game.status);
  result.hidden = !ended;
  result.textContent = ended ? `${game.status === "won" ? "NICE WORK" : "THE WORD WAS"} · ${game.answer.toUpperCase()}` : "";
}

function participantFor(attempt) {
  const participant = document.createElement("div");
  participant.className = "participant";
  if (!attempt) {
    participant.setAttribute("aria-hidden", "true");
    return participant;
  }
  if (config.showPlatform) {
    const marker = document.createElement("span");
    marker.className = "platform-glyph";
    marker.textContent = platformPresentation(attempt.platform).glyph;
    participant.append(marker);
  }
  const name = document.createElement("span");
  name.className = "participant-name";
  name.textContent = attempt.displayName;
  name.dataset.glitch = name.textContent;
  participant.append(name);
  return participant;
}

function persist() {
  if (!config.mock) saveGame(window.localStorage, storageKey(config.lang, config.wordLength), game.serialize());
}

function reasonText(outcome) {
  const labels = {
    paused: "Guesses are paused.", "round-ended": "Start a new round first.", length: `Guess must be ${game.wordLength} letters.`,
    dictionary: "Word is not in this language list.", duplicate: "Duplicate guess ignored.", queued: "That viewer already has a queued guess.",
    "user-cooldown": `Viewer cooldown: ${Math.ceil((outcome.retryAfter || 0) / 1000)}s.`, "queue-full": "Guess queue is full."
  };
  return labels[outcome.reason] || "Guess ignored.";
}

function showDiagnostic(message, force = false) {
  if (!config.debug && !force) return;
  diagnostic.hidden = false;
  diagnostic.textContent = message;
}

function playSound(kind) {
  if (!config.sound || config.volume <= 0) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state !== "running") return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.frequency.value = kind === "win" ? 660 : 420;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(config.volume * 0.16, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "win" ? 0.32 : 0.1));
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + (kind === "win" ? 0.34 : 0.12));
  } catch { /* Optional audio never blocks the overlay. */ }
}

function startMockMode() {
  buildDebugControls();
  showDiagnostic("Mock mode active. Use the controls or Alt+1…9.");
  inject("twitch", "FirstViewer", firstGuess());
}

function buildDebugControls() {
  debugPanel.hidden = false;
  const title = document.createElement("strong");
  title.textContent = "WORDLESTREAM LAB";
  debugPanel.append(title);
  const fixtures = [
    ["EN valid", () => switchLanguage("en", "crane")],
    ["ES valid", () => switchLanguage("es", "juego")],
    ["Invalid", () => inject("twitch", "viewer", "zzzzz")],
    ["Duplicate", demoDuplicate],
    ["Cooldown", demoCooldown],
    ["Platforms", demoPlatforms],
    ["Unicode / long", () => inject("youtube", "Canal_Ñandú_✨_con_un_nombre_extremadamente_largo_para_probar_el_recorte", firstGuess())],
    ["Victory", demoVictory],
    ["Failure", demoFailure],
    ["Pause / resume", demoAdmin],
    ["Reset", () => { game.control("reset"); render(); showDiagnostic("State reset."); }]
  ];
  fixtures.forEach(([label, action], index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${index < 9 ? `${index + 1} · ` : ""}${label}`;
    button.setAttribute("aria-label", `Run mock scenario: ${label}`);
    button.addEventListener("click", action);
    debugPanel.append(button);
  });
  const glitchButton = document.createElement("button");
  glitchButton.type = "button";
  glitchButton.textContent = "Glitch pulse";
  glitchButton.setAttribute("aria-label", "Trigger a brief WordleStream glitch preview");
  glitchButton.addEventListener("click", triggerInstability);
  debugPanel.append(glitchButton);
  window.addEventListener("keydown", (event) => {
    if (!event.altKey) return;
    const index = Number(event.key) - 1;
    if (fixtures[index]) { event.preventDefault(); fixtures[index][1](); }
  });
}

function scheduleInstability() {
  if (config.reduceMotion) return;
  const delay = 9_000 + Math.floor(Math.random() * 9_000);
  instabilityTimer = window.setTimeout(() => {
    triggerInstability();
    scheduleInstability();
  }, delay);
}

function triggerInstability() {
  if (config.reduceMotion || gamePanel.classList.contains("is-glitching")) return;
  gamePanel.classList.add("is-glitching");
  glitchTimer = window.setTimeout(() => gamePanel.classList.remove("is-glitching"), 380);
}

function switchLanguage(language, guess) {
  config = { ...config, lang: language };
  game = createGame(language, guess === "crane" || guess === "juego" ? guess : undefined);
  latestAttemptCount = 0;
  inject(language === "en" ? "twitch" : "youtube", language === "en" ? "EnglishViewer" : "VisorEspañol", guess);
}

function inject(platform, name, guess, extra = {}) {
  ingest({ type: platform, chatname: name, chatmessage: `${config.commands[0]} ${guess}`, userid: `${platform}-${name}`, ...extra });
}

function firstGuess() {
  return getDictionary(config.lang, config.wordLength, config.accents).accepted.find((word) => word !== game.answer && !game.attempts.some((attempt) => attempt.word === word)) || game.answer;
}

function demoDuplicate() {
  game.reset(false);
  const guess = firstGuess();
  inject("twitch", "FirstViewer", guess);
  inject("kick", "SecondViewer", guess);
}

function demoCooldown() {
  game.reset(false);
  const words = getDictionary(config.lang, config.wordLength, config.accents).accepted.filter((word) => word !== game.answer).slice(0, 2);
  inject("twitch", "FastViewer", words[0]);
  inject("twitch", "FastViewer", words[1]);
}

function demoPlatforms() {
  game.reset(false);
  const words = getDictionary(config.lang, config.wordLength, config.accents).accepted.filter((word) => word !== game.answer).slice(0, 4);
  ["twitch", "kick", "youtube", "streamplace"].forEach((platform, index) => inject(platform, `${platform}_viewer`, words[index]));
}

function demoVictory() {
  game = createGame(config.lang, config.lang === "es" ? "juego" : "crane");
  latestAttemptCount = 0;
  inject("twitch", "Winner", game.answer);
}

function demoFailure() {
  game = createGame(config.lang, config.lang === "es" ? "juego" : "crane");
  const guesses = getDictionary(config.lang, config.wordLength, config.accents).accepted.filter((word) => word !== game.answer).slice(0, game.maxAttempts);
  let now = 100_000;
  guesses.forEach((guess, index) => {
    game.submit({ guess, identity: `mock:${index}`, displayName: `Viewer ${index + 1}`, platform: index % 2 ? "kick" : "twitch" }, now);
    game.processNext(now);
    now += game.globalCooldown + 1;
  });
  render();
  showDiagnostic("Six-attempt failure demonstrated.");
}

function demoAdmin() {
  ingest({ type: "twitch", chatname: "Broadcaster", userid: "owner", broadcaster: true, chatmessage: `${config.commands.at(-1)} pause` });
  window.setTimeout(() => ingest({ type: "twitch", chatname: "Broadcaster", userid: "owner", broadcaster: true, chatmessage: `${config.commands.at(-1)} resume` }), 700);
}
