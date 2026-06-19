import test from "node:test";
import assert from "node:assert/strict";

import {
  InquiryValidationError,
  normalizeInquiryInput,
  verifyTurnstileToken,
} from "../src/utils/inquirySecurity.ts";

const validInput = {
  name: "  Jane Doe  ",
  email: " JANE@example.com ",
  phone: " +1 555 0100 ",
  country: " US ",
  company: " Example Inc ",
  product_type: " Hoodie ",
  quantity: " 500 ",
  message: "  Please send a quote.  ",
  turnstileToken: "token",
};

test("normalizeInquiryInput trims fields and normalizes email", () => {
  assert.deepEqual(normalizeInquiryInput(validInput), {
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "+1 555 0100",
    country: "US",
    company: "Example Inc",
    product_type: "Hoodie",
    quantity: "500",
    message: "Please send a quote.",
    turnstileToken: "token",
  });
});

test("normalizeInquiryInput rejects invalid email and oversized fields", () => {
  assert.throws(
    () => normalizeInquiryInput({ ...validInput, email: "not-an-email" }),
    InquiryValidationError,
  );
  assert.throws(
    () => normalizeInquiryInput({ ...validInput, message: "x".repeat(4001) }),
    InquiryValidationError,
  );
  assert.throws(
    () => normalizeInquiryInput({ ...validInput, turnstileToken: "" }),
    InquiryValidationError,
  );
});

test("verifyTurnstileToken sends server-side validation and enforces action", async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return Response.json({
      success: true,
      action: "turnstile-spin-v1",
      hostname: "kelloggfashion.com",
      "error-codes": [],
    });
  };

  const result = await verifyTurnstileToken({
    token: "token",
    secret: "secret",
    remoteIp: "203.0.113.1",
    allowedHostnames: ["kelloggfashion.com"],
    fetcher,
  });

  assert.equal(result.success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.response, "token");
  assert.equal(body.remoteip, "203.0.113.1");
  assert.equal(body.secret, "secret");
  assert.equal(typeof body.idempotency_key, "string");
});

test("verifyTurnstileToken rejects hostname and action mismatches", async () => {
  const fetcher = async () => Response.json({
    success: true,
    action: "login",
    hostname: "evil.example",
    "error-codes": [],
  });

  const result = await verifyTurnstileToken({
    token: "token",
    secret: "secret",
    remoteIp: "203.0.113.1",
    allowedHostnames: ["kelloggfashion.com"],
    fetcher,
  });

  assert.equal(result.success, false);
});
