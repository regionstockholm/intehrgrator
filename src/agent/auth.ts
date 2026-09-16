/**
 * Shared-secret check for the Agent API when bind is not loopback or a token is set.
 */

export const AGENT_TOKEN_HEADER = "x-intehr-token";

export function agentTokenFromRequest(req: Request): string | undefined {
  const bearer = req.headers.get("authorization");
  if (bearer) {
    const match = /^Bearer\s+(.+)$/i.exec(bearer.trim());
    if (match?.[1]) return match[1].trim();
  }
  const header = req.headers.get(AGENT_TOKEN_HEADER)?.trim();
  return header || undefined;
}

export function agentApiUnauthorized(req: Request, expectedToken: string | undefined): Response | null {
  if (!expectedToken) return null;
  const path = new URL(req.url).pathname;
  if (path === "/api/v1/health" || path.endsWith("/api/v1/health")) return null;
  const provided = agentTokenFromRequest(req);
  if (provided === expectedToken) return null;
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
