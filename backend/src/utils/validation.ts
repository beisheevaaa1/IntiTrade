export function normalizePhone(value: string) {
  const input = value.trim();
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;

  let normalized: string;
  if (input.startsWith("+")) normalized = `+${digits}`;
  else if (digits.startsWith("00")) normalized = `+${digits.slice(2)}`;
  else if (digits.startsWith("60")) normalized = `+${digits}`;
  else if (digits.startsWith("0")) normalized = `+60${digits.slice(1)}`;
  else normalized = `+${digits}`;

  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

export function getAllowedEmailDomains(domains: string, legacyDomain?: string) {
  const configured = domains || legacyDomain || "";
  return configured
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export function isAllowedEmail(email: string, domains: string[]) {
  if (domains.length === 0) return true;
  const domain = email.toLowerCase().split("@")[1];
  return domains.includes(domain);
}

export function isPasswordWithinBcryptLimit(password: string) {
  return Buffer.byteLength(password, "utf8") <= 72;
}
