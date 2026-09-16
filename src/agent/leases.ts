/**
 * Advisory slot leases for parallel Agent API / MCP writers (S-15).
 */

export interface SlotLease {
  slotId: string;
  agentId: string;
  displayName: string;
  expiresAt: number;
}

export class SlotLeaseRegistry {
  private readonly leases = new Map<string, SlotLease>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  list(): SlotLease[] {
    this.purgeExpired();
    return [...this.leases.values()].map((row) => ({ ...row }));
  }

  get(slotId: string): SlotLease | undefined {
    this.purgeExpired();
    const row = this.leases.get(slotId);
    return row ? { ...row } : undefined;
  }

  /**
   * Acquire or renew. Returns the lease, or the foreign holder when blocked.
   */
  acquire(
    slotId: string,
    agent: { agentId: string; displayName?: string },
    ttlSec = 120,
  ): { ok: true; lease: SlotLease } | { ok: false; holder: SlotLease } {
    this.purgeExpired();
    const ttl = Math.min(Math.max(1, Math.floor(ttlSec)), 3600) * 1000;
    const existing = this.leases.get(slotId);
    if (existing && existing.agentId !== agent.agentId) {
      return { ok: false, holder: { ...existing } };
    }
    const lease: SlotLease = {
      slotId,
      agentId: agent.agentId,
      displayName: agent.displayName?.trim() || agent.agentId,
      expiresAt: this.now() + ttl,
    };
    this.leases.set(slotId, lease);
    return { ok: true, lease: { ...lease } };
  }

  release(slotId: string, agentId?: string): boolean {
    this.purgeExpired();
    const existing = this.leases.get(slotId);
    if (!existing) return false;
    if (agentId && existing.agentId !== agentId) return false;
    this.leases.delete(slotId);
    return true;
  }

  /** Slot ids in `ids` held by someone other than `agentId`. */
  foreignHeld(ids: Iterable<string>, agentId?: string): SlotLease[] {
    this.purgeExpired();
    const out: SlotLease[] = [];
    for (const slotId of ids) {
      const row = this.leases.get(slotId);
      if (row && row.agentId !== agentId) out.push({ ...row });
    }
    return out;
  }

  private purgeExpired(): void {
    const t = this.now();
    for (const [id, row] of this.leases) {
      if (row.expiresAt <= t) this.leases.delete(id);
    }
  }
}
