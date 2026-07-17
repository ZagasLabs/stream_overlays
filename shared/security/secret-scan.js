const PLACEHOLDERS = /^(?:SESSION(?:_ID)?|YOUR[_-]?(?:SESSION|STREAM)[_-]?ID|X{4,}|ABC[_-]?123|OWNER|REPOSITORY)$/i;

export function scanSecrets(file, content) {
  const findings = [];
  const text = String(content);
  for (const match of text.matchAll(/[?#&]session=([^&\s"'`<>)]{8,})/gi)) {
    const value = decodeURIComponentSafe(match[1]).replace(/[}\].,;]+$/, "");
    if (!isPlaceholder(value) && !value.includes("${")) findings.push(`possible hard-coded SSN session: ${redact(value)}`);
  }
  for (const match of text.matchAll(/\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{20,})\b/g)) {
    findings.push(`possible token: ${redact(match[0])}`);
  }
  if (/\b(?:session|token|api[_-]?key|secret)\s*[=:]\s*["'][A-Za-z0-9_-]{16,}["']/i.test(text) && !/SESSION_ID|YOUR_TOKEN|example/i.test(text)) {
    findings.push("possible credential assignment");
  }
  if (/fixtures?[/\\].*\.json$/i.test(file) && /"(?:session|token|secret|apiKey)"\s*:/i.test(text)) {
    findings.push("credential-like field in fixture");
  }
  return findings;
}

function isPlaceholder(value) {
  return PLACEHOLDERS.test(value) || /SESSION_ID|SESSIONIDHERE|XXXXX|xxxxxxxx/i.test(value);
}

function redact(value) {
  return `${String(value).slice(0, 3)}…(${String(value).length})`;
}

function decodeURIComponentSafe(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}
