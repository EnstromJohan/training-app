import { afterEach, describe, expect, it, vi } from "vitest";

const call = async (headers: Record<string, string> = {}, body: unknown = {}) => {
  const { POST } = await import("../route");
  return POST(new Request("http://localhost/api/body-estimate", { method: "POST", headers, body: JSON.stringify(body) }));
};

describe("POST /api/body-estimate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is disabled without a server API key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const res = await call();
    expect(res.status).toBe(503);
  });

  it("requires Supabase to be configured", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect((await call()).status).toBe(503);
  });

  it("rejects requests without a login token", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    const res = await call();
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("estimate output schema", () => {
  it("converts to a JSON schema usable for structured output", async () => {
    const { betaZodOutputFormat } = await import("@anthropic-ai/sdk/helpers/beta/zod");
    const { EstimateSchema } = await import("@/lib/ai-estimate-schema");
    const format = betaZodOutputFormat(EstimateSchema) as unknown as { type: string; schema: { properties: Record<string, unknown>; required: string[] } };
    expect(format.type).toBe("json_schema");
    expect(Object.keys(format.schema.properties)).toEqual(["assessable", "bodyFatLow", "bodyFatHigh", "bodyFatMid", "confidence", "cues", "limitations"]);
    expect(format.schema.required).toContain("bodyFatLow");
  });
});
