import type { z } from "zod";
import {
  ApiErrorSchema,
  ContentSchema,
  SessionInfoSchema,
  type Content,
  type SessionInfo,
  MatchReplaySchema,
  MatchSummarySchema,
  type MatchReplay,
  type MatchSummary,
} from "@replay-lab/shared";

/** A failed API call with a message safe to show the user. */
export class ApiRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function getJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new ApiRequestError("Can't reach the server. Is it running?");
  }
  const body: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    const err = ApiErrorSchema.safeParse(body);
    throw new ApiRequestError(
      err.success ? err.data.error.message : `Request failed (${res.status})`,
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiRequestError("The server sent data in an unexpected shape.");
  return parsed.data;
}

export function fetchMatches(): Promise<MatchSummary[]> {
  return getJson("/api/matches", MatchSummarySchema.array());
}

export function fetchReplay(matchId: string): Promise<MatchReplay> {
  return getJson(`/api/matches/${encodeURIComponent(matchId)}`, MatchReplaySchema);
}

export function fetchSession(): Promise<SessionInfo> {
  return getJson("/api/session", SessionInfoSchema);
}

export function fetchContent(): Promise<Content> {
  return getJson("/api/content", ContentSchema);
}

export function errorMessage(err: unknown): string {
  return err instanceof ApiRequestError ? err.message : "Something went wrong.";
}
