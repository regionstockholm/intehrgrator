import type { ProjectBundle } from "../types/mod.ts";

/** Stable revision token for optimistic concurrency on agent mutations. */
export function bundleRevision(bundle: ProjectBundle): string {
  const mapping = bundle.mapping;
  const payload = JSON.stringify({
    model: mapping.model,
    blocklyState: mapping.blocklyState,
    handlebarsTemplate: mapping.handlebarsTemplate ?? "",
  });
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `r${(hash >>> 0).toString(16)}`;
}
