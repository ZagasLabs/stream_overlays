export function renderMessage(message, config = {}) {
  const article = document.createElement("article");
  article.className = `chat-card chat-card--${message.kind}`;
  article.dataset.platform = safeClass(message.platform.type);
  article.setAttribute("role", "listitem");
  article.setAttribute("aria-label", labelForMessage(message));

  if (message.kind === "event") renderEvent(article, message, config);
  else if (message.kind === "donation" || message.kind === "major-event") renderMajorEvent(article, message, config);
  else renderChat(article, message, config);

  return article;
}

function renderChat(root, message, config) {
  const hasIdentity = Boolean(message.author.name || message.author.avatarUrl);
  root.classList.toggle("chat-card--no-avatar", config.showAvatar === false || !hasIdentity);
  const punctuation = punctuationForText(message.content.text);

  if (config.showAvatar !== false && hasIdentity) root.append(renderAvatar(message));

  const shell = document.createElement("div");
  shell.className = "message-shell";
  shell.append(makeAccent("connector"));

  if (message.author.name || (config.showBadges !== false && message.author.badges.length)) {
    shell.append(renderAuthor(message, config));
  } else {
    shell.classList.add("message-shell--anonymous");
  }

  const bodyWrap = document.createElement("div");
  bodyWrap.className = "message-body-wrap";
  bodyWrap.append(renderBody(message));
  if (punctuation) bodyWrap.append(makePunctuationImpact(punctuation));
  shell.append(bodyWrap);
  if (config.showPlatform !== false) shell.append(renderPlatform(message));
  root.append(shell);
}

function renderEvent(root, message, config) {
  root.append(makeAccent("arrow"));
  const banner = document.createElement("div");
  banner.className = "event-banner";
  const surface = document.createElement("div");
  surface.className = "event-surface";

  appendText(surface, "span", "event-kicker", message.event?.label || "Update");
  if (message.author.name) appendText(surface, "strong", "event-title", message.author.name);
  const description = message.content.text || message.event?.detail || "";
  if (description) appendText(surface, "span", "event-message", description);
  if (config.showPlatform !== false) surface.append(renderPlatform(message));

  banner.append(surface);
  root.append(banner);
}

function renderMajorEvent(root, message, config) {
  const panel = document.createElement("div");
  panel.className = "donation-panel";
  const surface = document.createElement("div");
  surface.className = "donation-surface";
  surface.append(makeAccent("bolt"));

  appendText(surface, "span", "event-kicker", message.event?.label || message.donation?.label || "Support");
  if (message.author.name) appendText(surface, "strong", "donation-author", message.author.name);

  const amount = message.donation?.amount || (message.event?.major ? message.event.label : "");
  if (amount) appendText(surface, "span", "donation-amount", amount);

  const description = message.content.text || message.event?.detail || message.donation?.label || "";
  if (description) appendText(surface, "p", "donation-message", description);
  if (config.showPlatform !== false) surface.append(renderPlatform(message));

  panel.append(surface);
  root.append(panel);
}

function renderAvatar(message) {
  const frame = document.createElement("div");
  frame.className = "avatar-frame";
  const accent = document.createElement("div");
  accent.className = "avatar-accent";
  const surface = document.createElement("div");
  surface.className = "avatar-surface";

  const fallback = document.createElement("span");
  fallback.className = "avatar-fallback";
  fallback.textContent = initialFor(message.author.name);
  surface.append(fallback);

  if (message.author.avatarUrl) {
    const image = document.createElement("img");
    image.src = message.author.avatarUrl;
    image.alt = "";
    image.loading = "eager";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => image.remove(), { once: true });
    surface.append(image);
  }

  accent.append(surface);
  frame.append(accent);
  return frame;
}

function renderAuthor(message, config) {
  const label = document.createElement("header");
  label.className = "author-label";
  if (message.author.name) appendText(label, "span", "author-name", message.author.name);

  if (config.showBadges !== false && message.author.badges.length > 0) {
    const badges = document.createElement("span");
    badges.className = "badge-row";
    for (const badge of message.author.badges.slice(0, 3)) {
      const item = document.createElement("span");
      item.className = "badge";
      item.title = badge.label;
      if (badge.src) {
        const image = document.createElement("img");
        image.src = badge.src;
        image.alt = badge.label;
        image.referrerPolicy = "no-referrer";
        image.addEventListener("error", () => item.remove(), { once: true });
        item.append(image);
      } else {
        item.textContent = badge.label.slice(0, 3).toUpperCase();
      }
      badges.append(item);
    }
    label.append(badges);
  }

  if (message.author.roles.length > 0) label.dataset.roles = message.author.roles.join(" ");
  return label;
}

function renderBody(message) {
  const body = document.createElement("div");
  body.className = "message-body";
  const textLength = message.content.text.length;
  if (textLength > 240) body.dataset.length = "long";
  else if (textLength > 120) body.dataset.length = "medium";

  const surface = document.createElement("div");
  surface.className = "message-surface";
  const content = document.createElement("p");
  content.className = "message-text";

  message.content.parts.forEach((part, index) => {
    if (part.type === "img") {
      const image = document.createElement("img");
      image.className = `inline-emote ${part.className || ""}`.trim();
      image.src = part.src;
      image.alt = part.alt;
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => image.remove(), { once: true });
      content.append(image);
    } else {
      if (index > 0 && content.lastChild) content.append(document.createTextNode(" "));
      content.append(document.createTextNode(part.text));
    }
  });

  surface.append(content);
  body.append(surface);
  return body;
}

function renderPlatform(message) {
  const marker = document.createElement("span");
  marker.className = `platform-marker platform-marker--${safeClass(message.platform.type)}`;
  if (message.platform.icon) {
    const icon = document.createElement("img");
    icon.src = message.platform.icon;
    icon.alt = "";
    icon.referrerPolicy = "no-referrer";
    icon.addEventListener("error", () => icon.remove(), { once: true });
    marker.append(icon);
  }
  appendText(marker, "span", "platform-label", message.platform.label);
  return marker;
}

function makeAccent(name) {
  const accent = document.createElement("span");
  accent.className = `impact impact--${name}`;
  accent.setAttribute("aria-hidden", "true");
  return accent;
}

function makePunctuationImpact(punctuation) {
  const impact = makeAccent("punctuation");
  impact.textContent = punctuation;
  impact.classList.toggle("impact--double", punctuation.length > 1);
  return impact;
}

export function punctuationForText(value) {
  const text = String(value || "");
  const hasQuestion = /[?？]/.test(text);
  const hasExclamation = /[!！]/.test(text);
  if (hasQuestion && hasExclamation) return "?!";
  if (hasQuestion) return "?";
  if (hasExclamation) return "!";
  return "";
}

function appendText(parent, tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function initialFor(name) {
  const trimmed = String(name || "").trim();
  return trimmed ? [...trimmed][0].toUpperCase() : "•";
}

function safeClass(value) {
  return String(value || "unknown").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").slice(0, 40) || "unknown";
}

function labelForMessage(message) {
  const event = message.event?.label ? `${message.event.label}: ` : "";
  const author = message.author.name ? `${message.author.name}: ` : "";
  return `${event}${author}${message.content.text || message.event?.detail || message.donation?.amount || ""}`.trim();
}
