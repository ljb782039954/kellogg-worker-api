import test from "node:test";
import assert from "node:assert/strict";

import { buildInquiryFilters } from "../src/utils/inquiryFilters.ts";

test("buildInquiryFilters combines status and search across supported fields", () => {
  const url = new URL(
    "https://example.com/api/inquiries?status=pending&search=Acme",
  );

  assert.deepEqual(buildInquiryFilters(url.searchParams), {
    whereString:
      "WHERE status = ? AND (name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\')",
    params: ["pending", "%Acme%", "%Acme%", "%Acme%"],
  });
});

test("buildInquiryFilters trims search and escapes LIKE wildcards", () => {
  const url = new URL(
    "https://example.com/api/inquiries?search=%20a%25_b%5Cc%20",
  );

  assert.deepEqual(buildInquiryFilters(url.searchParams), {
    whereString:
      "WHERE (name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\')",
    params: ["%a\\%\\_b\\\\c%", "%a\\%\\_b\\\\c%", "%a\\%\\_b\\\\c%"],
  });
});

test("buildInquiryFilters ignores blank search", () => {
  const url = new URL("https://example.com/api/inquiries?search=%20%20");

  assert.deepEqual(buildInquiryFilters(url.searchParams), {
    whereString: "",
    params: [],
  });
});
