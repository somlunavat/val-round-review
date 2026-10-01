import type { FastifyReply } from "fastify";
import type { ApiError } from "@replay-lab/shared";

type Code = ApiError["error"]["code"];

const STATUS: Record<Code, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  UPSTREAM: 502,
  INTERNAL: 500,
};

export function sendError(reply: FastifyReply, code: Code, message: string) {
  const body: ApiError = { error: { code, message } };
  return reply.status(STATUS[code]).send(body);
}
