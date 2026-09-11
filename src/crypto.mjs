import { createHash } from "node:crypto";

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(stable(value));
}

export function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function redact(value) {
  const secretKeys = /token|secret|password|cookie|authorization|api[-_]?key/i;
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, secretKeys.test(key) ? "[REDACTED]" : redact(item)])
    );
  }
  return value;
}
