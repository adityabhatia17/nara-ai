import type { FastifyReply } from "fastify";

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
): void {
  reply.code(statusCode).send({
    error: { code, message, ...(details ? { details } : {}) },
  });
}
