import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import handler from "../../api/reset-password";

function tokenFor(subject: string, method: string) {
  const payload = Buffer.from(JSON.stringify({
    sub: subject,
    amr: [{ method, timestamp: 1_800_000_000 }],
  })).toString("base64url");
  return `header.${payload}.signature`;
}

function responseRecorder() {
  let statusCode = 200;
  let body: unknown;
  const response = {
    setHeader: vi.fn(),
    status: vi.fn((code: number) => {
      statusCode = code;
      return response;
    }),
    json: vi.fn((value: unknown) => {
      body = value;
      return response;
    }),
    end: vi.fn(() => response),
  } as unknown as VercelResponse;

  return {
    response,
    get statusCode() { return statusCode; },
    get body() { return body; },
  };
}

describe("reset password API", () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_KEY = "service-key";
    process.env.SUPABASE_URL = "https://project.supabase.co";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SUPABASE_SERVICE_KEY;
    delete process.env.SUPABASE_URL;
  });

  it("rejects a regular signed-in session", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const recorder = responseRecorder();
    const request = {
      method: "POST",
      headers: { authorization: `Bearer ${tokenFor("user-1", "password")}` },
      body: { password: "secret123" },
    } as unknown as VercelRequest;

    await handler(request, recorder.response);

    expect(recorder.statusCode).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("updates only the user verified by the recovery token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "user-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "user-1" }), { status: 200 }));
    const recorder = responseRecorder();
    const request = {
      method: "POST",
      headers: { authorization: `Bearer ${tokenFor("user-1", "recovery")}` },
      body: { password: "same-password" },
    } as unknown as VercelRequest;

    await handler(request, recorder.response);

    expect(recorder.statusCode).toBe(200);
    expect(recorder.body).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://project.supabase.co/auth/v1/admin/users/user-1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ password: "same-password" }),
      }),
    );
  });

  it("rejects a token whose subject does not match the verified user", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "user-2" }), { status: 200 }));
    const recorder = responseRecorder();
    const request = {
      method: "POST",
      headers: { authorization: `Bearer ${tokenFor("user-1", "recovery")}` },
      body: { password: "secret123" },
    } as unknown as VercelRequest;

    await handler(request, recorder.response);

    expect(recorder.statusCode).toBe(401);
    expect(recorder.body).toEqual({ error: "invalid_recovery_session" });
  });
});
