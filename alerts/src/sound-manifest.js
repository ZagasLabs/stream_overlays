export const SOUND_TIERS = Object.freeze(["minor", "standard", "major"]);
export const SOUND_EVENTS = Object.freeze(["follow", "subscription", "resubscription", "membership", "gift", "raid", "donation", "bits", "superchat", "milestone", "generic-event"]);
export const MAX_CUSTOM_SOUND_BYTES = 4 * 1024 * 1024;

export function parseSoundManifest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Sound manifest must be an object.");
  if (input.version !== 1) throw new TypeError("Sound manifest version must be 1.");
  return {
    version: 1,
    tiers: parseGroup(input.tiers, SOUND_TIERS, "tiers"),
    events: parseGroup(input.events, SOUND_EVENTS, "events")
  };
}

export function isSafeCustomSoundPath(value) {
  return typeof value === "string"
    && value.length <= 160
    && /^custom\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9][a-zA-Z0-9_.-]*\.(?:ogg|wav)$/i.test(value)
    && !value.includes("..")
    && !value.includes("//");
}

export function soundManifestEntries(manifest) {
  return [
    ...Object.entries(manifest.tiers).map(([key, path]) => ({ kind: "tier", key, path })),
    ...Object.entries(manifest.events).map(([key, path]) => ({ kind: "event", key, path }))
  ];
}

function parseGroup(value, allowedKeys, label) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new TypeError(`Sound manifest ${label} must be an object.`);
  const output = {};
  for (const [key, path] of Object.entries(value)) {
    if (!allowedKeys.includes(key)) throw new TypeError(`Unsupported sound ${label} key: ${key}`);
    if (path == null || path === "") continue;
    if (!isSafeCustomSoundPath(path)) throw new TypeError(`Unsafe custom sound path for ${key}.`);
    output[key] = path;
  }
  return output;
}
