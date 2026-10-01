import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("app", () => {
  it("answers the health check", async () => {
    const res = await buildApp().inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("returns a typed error for unknown routes", async () => {
    const res = await buildApp().inject({ method: "GET", url: "/api/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });
});
