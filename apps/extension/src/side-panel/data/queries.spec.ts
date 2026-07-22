import { describe, expect, it } from "vitest";
import { ApiError } from "../../shared/api.ts";
import { isRetryableRead } from "../app/query-client.ts";
import { capturePollInterval, MAX_CAPTURE_POLL_UPDATES } from "./queries.ts";

describe("query lifecycle policy", () => {
  it("polls only non-terminal capture states", () => {
    expect(capturePollInterval("extracting")).toBe(2_000);
    expect(capturePollInterval("preparing")).toBe(2_000);
    expect(capturePollInterval("ready")).toBe(false);
    expect(capturePollInterval("failed")).toBe(false);
    expect(capturePollInterval("preparing", 2)).toBe(false);
    expect(
      capturePollInterval("preparing", 0, MAX_CAPTURE_POLL_UPDATES),
    ).toBe(false);
  });
  it("retries only transient read failures", () => {
    expect(isRetryableRead(new ApiError("busy", 503, {}))).toBe(true);
    expect(isRetryableRead(new ApiError("bad", 400, {}))).toBe(false);
    expect(isRetryableRead(new TypeError("offline"))).toBe(true);
  });
});
