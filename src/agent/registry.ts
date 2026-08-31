import { colorFromAgentId } from "./actor.ts";

export interface RegisteredAgent {
  agentId: string;
  displayName: string;
  color: string;
  registeredAt: string;
}

export class AgentRegistry {
  private readonly agents = new Map<string, RegisteredAgent>();
  private seq = 0;

  register(options?: { agentId?: string; displayName?: string; color?: string }): RegisteredAgent {
    const agentId = options?.agentId?.trim() || `agent-${++this.seq}-${crypto.randomUUID().slice(0, 8)}`;
    const displayName = options?.displayName?.trim() || agentId;
    const color = options?.color?.trim() || colorFromAgentId(agentId);
    const entry: RegisteredAgent = {
      agentId,
      displayName,
      color,
      registeredAt: new Date().toISOString(),
    };
    this.agents.set(agentId, entry);
    return entry;
  }

  get(agentId: string): RegisteredAgent | undefined {
    return this.agents.get(agentId);
  }

  list(): RegisteredAgent[] {
    return [...this.agents.values()];
  }
}
