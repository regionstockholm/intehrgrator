export interface SavedDefaultsMapEntry {
  id: string;
  displayName: string;
  savedAt: string;
}

export interface SavedDefaultsMapRecord extends SavedDefaultsMapEntry {
  /** Blockly JSON for a `maps_create_with` block (the Defaults Map argument). */
  mapBlock: unknown;
}

export interface DefaultsCatalog {
  list(): Promise<SavedDefaultsMapEntry[]>;
  save(displayName: string, mapBlock: unknown): Promise<SavedDefaultsMapEntry>;
  load(id: string): Promise<unknown | null>;
}

export function createMemoryDefaultsCatalog(
  seed: SavedDefaultsMapRecord[] = [],
): DefaultsCatalog {
  const records = new Map<string, SavedDefaultsMapRecord>(
    seed.map((record) => [record.id, record]),
  );
  return {
    async list() {
      return [...records.values()]
        .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
        .map(({ id, displayName, savedAt }) => ({ id, displayName, savedAt }));
    },
    async save(displayName, mapBlock) {
      const record: SavedDefaultsMapRecord = {
        id: crypto.randomUUID(),
        displayName: displayName.trim() || "Defaults",
        savedAt: new Date().toISOString(),
        mapBlock,
      };
      records.set(record.id, record);
      return { id: record.id, displayName: record.displayName, savedAt: record.savedAt };
    },
    async load(id) {
      return records.get(id)?.mapBlock ?? null;
    },
  };
}
