export const GAME_SCHEMA_VERSION = 1;
export const ADMIN_ACTIONS = new Set(["start", "pause", "resume", "reset", "reveal", "new"]);

export function normalizeWord(value, accents = "fold") {
  let word = String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("es");
  if (accents === "fold") {
    word = word.replace(/[áàâäãå]/g, "a").replace(/[éèêë]/g, "e").replace(/[íìîï]/g, "i")
      .replace(/[óòôöõ]/g, "o").replace(/[úùûü]/g, "u").replace(/ç/g, "c");
  }
  return /^[\p{L}]+$/u.test(word) ? word : "";
}

export function parseChatCommand(message, commands) {
  const text = String(message ?? "").normalize("NFKC").trim();
  const match = text.match(/^(\S+)(?:\s+(\S+))?\s*$/u);
  if (!match || !commands.map((item) => item.toLocaleLowerCase("en-US")).includes(match[1].toLocaleLowerCase("en-US"))) return null;
  return { command: match[1], argument: match[2] || "" };
}

export function scoreGuess(guess, answer) {
  const guessLetters = [...guess];
  const answerLetters = [...answer];
  if (guessLetters.length !== answerLetters.length) throw new Error("Guess and answer lengths must match.");
  const result = Array(guessLetters.length).fill("absent");
  const remaining = new Map();
  for (let index = 0; index < answerLetters.length; index += 1) {
    if (guessLetters[index] === answerLetters[index]) result[index] = "correct";
    else remaining.set(answerLetters[index], (remaining.get(answerLetters[index]) || 0) + 1);
  }
  for (let index = 0; index < guessLetters.length; index += 1) {
    if (result[index] === "correct") continue;
    const count = remaining.get(guessLetters[index]) || 0;
    if (count > 0) {
      result[index] = "present";
      remaining.set(guessLetters[index], count - 1);
    }
  }
  return result;
}

export class CooperativeWordGame {
  constructor({ answers, accepted, wordLength = 5, maxAttempts = 6, userCooldown = 10_000, globalCooldown = 1_500, maxQueue = 20, accents = "fold", random = Math.random, answer } = {}) {
    this.answers = answers.filter((word) => [...word].length === wordLength);
    this.accepted = new Set(accepted.filter((word) => [...word].length === wordLength));
    this.wordLength = wordLength;
    this.maxAttempts = maxAttempts;
    this.userCooldown = userCooldown;
    this.globalCooldown = globalCooldown;
    this.maxQueue = maxQueue;
    this.accents = accents;
    this.random = random;
    this.answer = answer || this.pickAnswer();
    this.attempts = [];
    this.queue = [];
    this.cooldowns = new Map();
    this.participants = new Set();
    this.lastGuessAt = null;
    this.status = "active";
  }

  submit({ guess, identity, displayName = "Viewer", platform = "unknown" }, now = Date.now()) {
    if (this.status !== "active") return { accepted: false, reason: this.status === "paused" ? "paused" : "round-ended" };
    const word = normalizeWord(guess, this.accents);
    if ([...word].length !== this.wordLength) return { accepted: false, reason: "length" };
    if (!this.accepted.has(word)) return { accepted: false, reason: "dictionary" };
    if (this.attempts.some((item) => item.word === word) || this.queue.some((item) => item.word === word)) return { accepted: false, reason: "duplicate" };
    if (!identity || this.queue.some((item) => item.identity === identity)) return { accepted: false, reason: "queued" };
    const availableAt = this.cooldowns.get(identity) || 0;
    if (now < availableAt) return { accepted: false, reason: "user-cooldown", retryAfter: availableAt - now };
    if (this.queue.length >= this.maxQueue) return { accepted: false, reason: "queue-full" };
    const item = { word, identity, displayName: String(displayName).slice(0, 80), platform, queuedAt: now };
    this.queue.push(item);
    this.cooldowns.set(identity, now + this.userCooldown);
    return { accepted: true, item, queueLength: this.queue.length };
  }

  processNext(now = Date.now()) {
    if (this.status !== "active" || this.queue.length === 0) return null;
    if (this.lastGuessAt !== null && now - this.lastGuessAt < this.globalCooldown) return null;
    const item = this.queue.shift();
    const scored = { ...item, score: scoreGuess(item.word, this.answer), acceptedAt: now };
    this.attempts.push(scored);
    this.participants.add(item.identity);
    this.lastGuessAt = now;
    if (item.word === this.answer) this.status = "won";
    else if (this.attempts.length >= this.maxAttempts) this.status = "lost";
    return scored;
  }

  control(action) {
    if (!ADMIN_ACTIONS.has(action)) return false;
    if (action === "pause" && this.status === "active") this.status = "paused";
    else if (action === "resume" && this.status === "paused") this.status = "active";
    else if (action === "reset") this.reset(false);
    else if (action === "new") this.reset(true);
    else if (action === "reveal" && ["active", "paused"].includes(this.status)) { this.status = "revealed"; this.queue.length = 0; }
    else if (action === "start") { if (["won", "lost", "revealed"].includes(this.status)) this.reset(true); else this.status = "active"; }
    else return false;
    return true;
  }

  reset(newAnswer = false) {
    const previous = this.answer;
    if (newAnswer) this.answer = this.pickAnswer(previous);
    this.attempts = [];
    this.queue = [];
    this.cooldowns.clear();
    this.participants.clear();
    this.lastGuessAt = null;
    this.status = "active";
  }

  pickAnswer(exclude = "") {
    if (!this.answers.length) throw new Error(`No answer words available at length ${this.wordLength}.`);
    const candidates = this.answers.length > 1 ? this.answers.filter((word) => word !== exclude) : this.answers;
    return candidates[Math.floor(this.random() * candidates.length)] || candidates[0];
  }

  serialize(now = Date.now()) {
    return {
      version: GAME_SCHEMA_VERSION, answer: this.answer, attempts: this.attempts, status: this.status,
      cooldowns: [...this.cooldowns].filter(([, expires]) => expires > now).slice(-100),
      participants: [...this.participants].slice(-250), lastGuessAt: this.lastGuessAt
    };
  }

  restore(value, now = Date.now()) {
    if (!isSafeState(value, this)) return false;
    this.answer = value.answer;
    this.attempts = value.attempts.map((attempt) => ({ ...attempt, displayName: String(attempt.displayName).slice(0, 80) }));
    this.status = value.status;
    this.cooldowns = new Map(value.cooldowns.filter(([identity, expires]) => typeof identity === "string" && Number.isFinite(expires) && expires > now).slice(-100));
    this.participants = new Set(value.participants.filter((identity) => typeof identity === "string").slice(-250));
    this.lastGuessAt = Number.isFinite(value.lastGuessAt) ? value.lastGuessAt : null;
    this.queue = [];
    return true;
  }
}

function isSafeState(value, game) {
  if (!value || value.version !== GAME_SCHEMA_VERSION || !game.answers.includes(value.answer)) return false;
  if (!Array.isArray(value.attempts) || value.attempts.length > game.maxAttempts || !Array.isArray(value.cooldowns) || !Array.isArray(value.participants)) return false;
  if (!["active", "paused", "won", "lost", "revealed"].includes(value.status)) return false;
  return value.attempts.every((attempt) => attempt && game.accepted.has(attempt.word) && Array.isArray(attempt.score) && attempt.score.length === game.wordLength &&
    attempt.score.every((score) => ["correct", "present", "absent"].includes(score)) && typeof attempt.identity === "string");
}
