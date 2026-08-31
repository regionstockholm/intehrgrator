/** Actor identity for attributed history (user or registered MCP agent). */

export interface HistoryActor {
  kind: "user" | "agent";
  id: string;
  displayName: string;
  color?: string;
}

export const USER_ACTOR: HistoryActor = {
  kind: "user",
  id: "user",
  displayName: "You",
};

export function actorFromHeaders(headers: Headers): HistoryActor {
  const agentId = headers.get("X-Agent-Id")?.trim();
  const agentName = headers.get("X-Agent-Name")?.trim();
  if (agentId) {
    return {
      kind: "agent",
      id: agentId,
      displayName: agentName || agentId,
      color: headers.get("X-Agent-Color")?.trim() || undefined,
    };
  }
  return USER_ACTOR;
}

export function colorFromAgentId(agentId: string): string {
  let hash = 2166136261;
  for (let i = 0; i < agentId.length; i++) {
    hash ^= agentId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hue = (hash >>> 0) % 360;
  return `hsl(${hue} 65% 45%)`;
}
