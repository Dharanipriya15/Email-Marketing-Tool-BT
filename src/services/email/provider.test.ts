import { afterEach, describe, expect, it, vi } from "vitest";
import { getEmailProvider, getSendingReadiness, isEmailProviderConfigured } from "./provider";
import { SesProvider } from "./ses-provider";
import { BrevoProvider } from "./brevo-provider";

const KEYS = [
  "EMAIL_PROVIDER",
  "EMAIL_PROVIDER_API_KEY",
  "EMAIL_FROM_ADDRESS",
  "EMAIL_FROM_NAME",
  "AWS_SES_REGION",
  "AWS_SES_ACCESS_KEY_ID",
  "AWS_SES_SECRET_ACCESS_KEY",
  "EMAIL_SENDING_ENABLED",
];

function setEnv(values: Record<string, string>) {
  for (const key of KEYS) vi.stubEnv(key, values[key] ?? "");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("provider selection", () => {
  it("defaults to Brevo when its key is set and EMAIL_PROVIDER is empty", () => {
    setEnv({ EMAIL_PROVIDER_API_KEY: "k", EMAIL_FROM_ADDRESS: "a@x.com", EMAIL_FROM_NAME: "A" });
    expect(getEmailProvider()).toBeInstanceOf(BrevoProvider);
  });

  it("uses SES when EMAIL_PROVIDER=ses and its settings are present", () => {
    setEnv({
      EMAIL_PROVIDER: "ses",
      AWS_SES_REGION: "us-east-1",
      AWS_SES_ACCESS_KEY_ID: "id",
      AWS_SES_SECRET_ACCESS_KEY: "secret",
      EMAIL_FROM_ADDRESS: "a@x.com",
      EMAIL_FROM_NAME: "A",
    });
    expect(isEmailProviderConfigured()).toBe(true);
    expect(getEmailProvider()).toBeInstanceOf(SesProvider);
  });

  it("is not configured when SES settings are missing and reports names only", () => {
    setEnv({ EMAIL_PROVIDER: "ses", EMAIL_FROM_ADDRESS: "a@x.com", EMAIL_FROM_NAME: "A" });
    expect(getEmailProvider()).toBeNull();
    const readiness = getSendingReadiness();
    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toEqual([
      "AWS_SES_REGION",
      "AWS_SES_ACCESS_KEY_ID",
      "AWS_SES_SECRET_ACCESS_KEY",
      "EMAIL_SENDING_ENABLED=true",
    ]);
  });

  it("is ready only when the kill switch is exactly 'true'", () => {
    setEnv({ EMAIL_PROVIDER_API_KEY: "k", EMAIL_FROM_ADDRESS: "a@x.com", EMAIL_FROM_NAME: "A", EMAIL_SENDING_ENABLED: "TRUE" });
    expect(getSendingReadiness().ready).toBe(false);
    vi.stubEnv("EMAIL_SENDING_ENABLED", "true");
    expect(getSendingReadiness()).toEqual({ ready: true, missing: [] });
  });
});