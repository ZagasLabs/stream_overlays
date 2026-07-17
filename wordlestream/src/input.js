import { platformIdentity, verifiedRoles } from "../../shared/platform.js";
import { toSafeText } from "../../shared/security/sanitizer.js";
import { ADMIN_ACTIONS, normalizeWord, parseChatCommand } from "./game.js";

export function normalizeSubmission(payload, config) {
  if (!payload || typeof payload !== "object" || payload.private) return null;
  const parsed = parseChatCommand(payload.chatmessage ?? payload.message ?? payload.text, config.commands);
  if (!parsed || !parsed.argument) return null;
  const identity = platformIdentity(payload);
  const action = parsed.argument.toLocaleLowerCase("en-US");
  if (ADMIN_ACTIONS.has(action)) return { kind: "admin", action, identity, authorized: isAdmin(payload, identity.id, config.admins) };
  return {
    kind: "guess", guess: normalizeWord(parsed.argument, config.accents), identity: identity.id,
    displayName: toSafeText(identity.displayName, 80), platform: identity.platform
  };
}

export function isAdmin(payload, identity, configuredAdmins = []) {
  const roles = verifiedRoles(payload);
  return roles.broadcaster || roles.moderator || configuredAdmins.includes(identity);
}
