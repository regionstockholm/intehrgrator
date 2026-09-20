/**
 * Optional in-app AI credentials for Call AI (OpenAI-compatible chat completions).
 * Stored in Host localStorage — never in the Project Bundle.
 */
export const AI_CREDENTIALS_STORAGE_KEY = "intehrgrator.ai.credentials";

export interface AiProviderCredentials {
  /** Chat completions URL, e.g. https://api.openai.com/v1/chat/completions */
  endpoint: string;
  apiKey: string;
  model: string;
}

export function parseAiCredentials(raw: unknown): AiProviderCredentials | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const endpoint = String(rec.endpoint ?? "").trim();
  const apiKey = String(rec.apiKey ?? "").trim();
  const model = String(rec.model ?? "").trim();
  if (!endpoint || !apiKey || !model) return null;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  } catch {
    return null;
  }
  return { endpoint, apiKey, model };
}

export function loadAiCredentials(storage: Storage): AiProviderCredentials | null {
  try {
    const raw = storage.getItem(AI_CREDENTIALS_STORAGE_KEY);
    if (!raw) return null;
    return parseAiCredentials(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveAiCredentials(storage: Storage, credentials: AiProviderCredentials): void {
  const parsed = parseAiCredentials(credentials);
  if (!parsed) throw new Error("AI credentials need an HTTP(S) endpoint, API key, and model");
  storage.setItem(AI_CREDENTIALS_STORAGE_KEY, JSON.stringify(parsed));
}

export function clearAiCredentials(storage: Storage): void {
  storage.removeItem(AI_CREDENTIALS_STORAGE_KEY);
}

export function hasAiCredentials(storage: Storage): boolean {
  return loadAiCredentials(storage) != null;
}

export interface ChatCompletionResult {
  text: string;
  raw: unknown;
}

/**
 * POST an OpenAI-compatible chat completion. The Web Shell may need a
 * CORS-friendly proxy; IDE/MCP remains valid without credentials.
 */
export async function callChatCompletions(
  credentials: AiProviderCredentials,
  prompt: string,
  options?: { fetch?: typeof fetch; signal?: AbortSignal },
): Promise<ChatCompletionResult> {
  const parsed = parseAiCredentials(credentials);
  if (!parsed) throw new Error("AI credentials are incomplete");
  const fetchImpl = options?.fetch ?? globalThis.fetch;
  const response = await fetchImpl(parsed.endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${parsed.apiKey}`,
    },
    body: JSON.stringify({
      model: parsed.model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are an intEHRgrator mapping assistant. Reply with intehrgrator-suggestions JSON version 2 only, in a fenced json block or as raw JSON.",
        },
        { role: "user", content: prompt },
      ],
    }),
    signal: options?.signal,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `AI call failed (${response.status} ${response.statusText})${detail ? `: ${detail.slice(0, 400)}` : ""}`,
    );
  }
  const raw = await response.json() as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = raw?.choices?.[0]?.message?.content;
  const text = typeof content === "string"
    ? content
    : Array.isArray(content)
    ? content.map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("")
    : "";
  if (!text.trim()) throw new Error("AI response had no text");
  return { text, raw };
}
