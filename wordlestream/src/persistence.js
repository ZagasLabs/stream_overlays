export function storageKey(lang, wordLength) {
  return `wordlestream:v1:${lang}:${wordLength}`;
}

export function saveGame(storage, key, state) {
  try { storage.setItem(key, JSON.stringify(state)); return true; } catch { return false; }
}

export function loadGame(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (!raw || raw.length > 100_000) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function clearGame(storage, key) {
  try { storage.removeItem(key); return true; } catch { return false; }
}
