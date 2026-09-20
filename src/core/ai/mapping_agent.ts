/**
 * Call AI mapping loop: OpenAI-compatible tools named like MCP / Agent API.
 */
import { looksLikeSuggestionsPayload } from "./mod.ts";
import {
  MAPPING_TOOLS_SYSTEM,
  postChatCompletions,
  type AiProviderCredentials,
  type ChatMessage,
} from "./credentials.ts";
import {
  executeMappingAgentTool,
  isMutatingCallAiTool,
  mappingAgentOpenAiTools,
} from "./controller_tools.ts";
import type { ImportSuggestionsReport } from "../../types/mod.ts";
import type { WorkbenchController } from "../../workbench/controller.ts";

export interface MappingAgentResult {
  text: string;
  toolNames: string[];
  imported?: ImportSuggestionsReport;
  steps: number;
}

export interface RunMappingAgentOptions {
  credentials: AiProviderCredentials;
  prompt: string;
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  fetch?: typeof fetch;
  signal?: AbortSignal;
  proxyUrl?: string;
  maxSteps?: number;
  onAfterMutation?: () => void;
  importText?: (text: string) => ImportSuggestionsReport;
}

function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  return {};
}

function assistantMessageForLoop(
  message: ChatMessage | undefined,
  toolCalls: Array<{ id: string; name: string; arguments: string }>,
): ChatMessage {
  if (message?.tool_calls?.length) return message;
  return {
    role: "assistant",
    content: message?.content ?? null,
    tool_calls: toolCalls.map((row) => ({
      id: row.id,
      type: "function",
      function: { name: row.name, arguments: row.arguments },
    })),
  };
}

export const MAPPING_TOOLS_USER_PREFIX =
  "The markdown that follows is project context (slot manifest, artifacts). Prefer the provided function tools over returning JSON only. Call list_slots and get_source_tree first, then map_slot for Click-to-Map paths, import_suggestions for loops / Decision tables / bulk envelopes, and run_test when done.";

export async function runMappingAgent(options: RunMappingAgentOptions): Promise<MappingAgentResult> {
  const tools = mappingAgentOpenAiTools();
  const messages: ChatMessage[] = [
    { role: "system", content: MAPPING_TOOLS_SYSTEM },
    { role: "user", content: `${MAPPING_TOOLS_USER_PREFIX}\n\n${options.prompt}` },
  ];
  const toolNames: string[] = [];
  const maxSteps = options.maxSteps ?? 16;
  let lastText = "";
  let imported: ImportSuggestionsReport | undefined;

  for (let step = 1; step <= maxSteps; step++) {
    const completion = await postChatCompletions(options.credentials, messages, {
      fetch: options.fetch,
      signal: options.signal,
      proxyUrl: options.proxyUrl,
      tools,
    });
    lastText = completion.text;
    const calls = completion.toolCalls ?? [];
    if (!calls.length) {
      if (options.importText && looksLikeSuggestionsPayload(completion.text)) {
        imported = options.importText(completion.text);
      }
      return { text: completion.text, toolNames, imported, steps: step };
    }

    messages.push(assistantMessageForLoop(completion.assistantMessage, calls));
    let mutated = false;
    for (const call of calls) {
      toolNames.push(call.name);
      const args = parseToolArgs(call.arguments);
      let payload: unknown;
      try {
        payload = await options.executeTool(call.name, args);
        if (isMutatingCallAiTool(call.name)) mutated = true;
        if (call.name === "import_suggestions" && payload && typeof payload === "object" && "report" in payload) {
          imported = (payload as { report: ImportSuggestionsReport }).report;
        }
      } catch (err) {
        payload = { error: err instanceof Error ? err.message : String(err) };
      }
      messages.push({
        role: "tool",
        name: call.name,
        tool_call_id: call.id,
        content: JSON.stringify(payload),
      });
    }
    if (mutated) options.onAfterMutation?.();
  }

  if (options.importText && looksLikeSuggestionsPayload(lastText)) {
    imported = options.importText(lastText);
  }
  return { text: lastText, toolNames, imported, steps: maxSteps };
}

export async function runMappingAgentOnController(
  controller: WorkbenchController,
  options: Omit<RunMappingAgentOptions, "executeTool" | "importText">,
): Promise<MappingAgentResult> {
  return await runMappingAgent({
    ...options,
    executeTool: (name, args) => executeMappingAgentTool(controller, name, args),
    importText: (text) => controller.importAiSuggestions(text),
  });
}
