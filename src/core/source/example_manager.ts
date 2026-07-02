import type { ExampleInstance } from "../../types/mod.ts";

export class ExampleInstanceManager {
  private examples = new Map<string, ExampleInstance>();
  private activeId: string | null = null;
  private cache = new Map<string, unknown>();

  addExample(example: ExampleInstance): void {
    this.examples.set(example.id, example);
    if (!this.activeId) this.activeId = example.id;
  }

  removeExample(id: string): void {
    this.examples.delete(id);
    this.cache.delete(id);
    if (this.activeId === id) {
      this.activeId = this.examples.keys().next().value ?? null;
    }
  }

  setActive(id: string): void {
    if (!this.examples.has(id)) throw new Error(`Unknown example: ${id}`);
    this.activeId = id;
  }

  getActive(): ExampleInstance | null {
    return this.activeId ? this.examples.get(this.activeId) ?? null : null;
  }

  list(): ExampleInstance[] {
    return [...this.examples.values()];
  }

  hasExamples(): boolean {
    return this.examples.size > 0;
  }

  getCachedResult(id: string): unknown | undefined {
    return this.cache.get(id);
  }

  setCachedResult(id: string, result: unknown): void {
    this.cache.set(id, result);
  }

  clearCache(id?: string): void {
    if (id) this.cache.delete(id);
    else this.cache.clear();
  }
}
