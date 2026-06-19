import type { CreateInquiryInput } from "../types";

const LIMITS = {
  name: 120,
  email: 254,
  phone: 50,
  country: 100,
  company: 200,
  product_type: 120,
  quantity: 100,
  message: 4000,
  turnstileToken: 2048,
} as const;

export class InquiryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InquiryValidationError";
  }
}

function textField(value: unknown, field: keyof typeof LIMITS, required = false): string {
  if (typeof value !== "string") {
    if (required) throw new InquiryValidationError(`${field} is required`);
    return "";
  }
  const normalized = value.trim();
  if (required && !normalized) throw new InquiryValidationError(`${field} is required`);
  if (normalized.length > LIMITS[field]) throw new InquiryValidationError(`${field} is too long`);
  return normalized;
}

export function normalizeInquiryInput(input: unknown): CreateInquiryInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new InquiryValidationError("Invalid request body");
  }

  const value = input as Record<string, unknown>;
  const email = textField(value.email, "email", true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new InquiryValidationError("Invalid email address");
  }

  return {
    name: textField(value.name, "name", true),
    email,
    phone: textField(value.phone, "phone"),
    country: textField(value.country, "country"),
    company: textField(value.company, "company"),
    product_type: textField(value.product_type, "product_type"),
    quantity: textField(value.quantity, "quantity"),
    message: textField(value.message, "message", true),
    turnstileToken: textField(value.turnstileToken, "turnstileToken", true),
  };
}

interface TurnstileResponse {
  success: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
}

interface VerifyTurnstileOptions {
  token: string;
  secret: string;
  remoteIp?: string;
  allowedHostnames: string[];
  fetcher?: typeof fetch;
}

const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";

export async function verifyTurnstileToken({
  token,
  secret,
  remoteIp,
  allowedHostnames,
  fetcher = fetch,
}: VerifyTurnstileOptions): Promise<TurnstileResponse> {
  if (!secret || !token || token.length > LIMITS.turnstileToken) return { success: false };

  try {
    const response = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
        idempotency_key: crypto.randomUUID(),
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { success: false, "error-codes": ["siteverify-unavailable"] };

    const result = await response.json<TurnstileResponse>();
    const hostname = result.hostname?.toLowerCase();
    const hostnameAllowed = Boolean(hostname && allowedHostnames.includes(hostname));
    const actionAllowed = result.action === "turnstile-spin-v1"
      || (secret === TURNSTILE_TEST_SECRET && result.action === "test");
    return result.success && actionAllowed && hostnameAllowed
      ? result
      : { ...result, success: false };
  } catch {
    return { success: false, "error-codes": ["siteverify-unavailable"] };
  }
}
