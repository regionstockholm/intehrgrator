import { assert, assertEquals } from "@std/assert";
import {
  AI_PROVIDER_PRESETS,
  applyAiProviderPreset,
  findAiProviderPreset,
} from "@intehrgrator/core/ai/providers.ts";

Deno.test("provider catalog covers Gemini, OpenAI, Anthropic, Ollama, LM Studio, Hugging Face, OpenCode", () => {
  const ids = AI_PROVIDER_PRESETS.map((row) => row.id);
  for (
    const id of [
      "gemini",
      "openai",
      "anthropic",
      "ollama-local",
      "ollama-cloud",
      "lmstudio-local",
      "lmstudio-cloud",
      "huggingface",
      "opencode-zen",
      "opencode-cloud",
    ]
  ) {
    assert(ids.includes(id), `missing provider ${id}`);
  }
});

Deno.test("each preset has an official docs URL, key URL, and HTTPS or loopback endpoint", () => {
  for (const preset of AI_PROVIDER_PRESETS) {
    if (preset.id === "custom") continue;
    assert(preset.docsUrl.startsWith("https://"), preset.id);
    assert(preset.keyUrl.startsWith("https://"), preset.id);
    assert(preset.help.trim().length > 40, preset.id);
    if (preset.id === "opencode-cloud") {
      assertEquals(preset.endpoint, "");
      continue;
    }
    const url = new URL(preset.endpoint);
    const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    assert(url.protocol === "https:" || loopback, preset.id);
    assert(preset.endpoint.includes("/chat/completions"), preset.id);
  }
});

Deno.test("applyAiProviderPreset fills Gemini OpenAI-compatible chat completions", () => {
  const applied = applyAiProviderPreset("gemini");
  assertEquals(applied.providerId, "gemini");
  assertEquals(
    applied.endpoint,
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  );
  assertEquals(applied.model, "gemini-3.8-flash");
  assertEquals(applied.apiKey, "");
});

Deno.test("local Ollama and LM Studio use dummy keys the servers ignore", () => {
  const ollama = applyAiProviderPreset("ollama-local");
  assertEquals(ollama.endpoint, "http://127.0.0.1:11434/v1/chat/completions");
  assertEquals(ollama.apiKey, "ollama");
  const lm = applyAiProviderPreset("lmstudio-local");
  assertEquals(lm.endpoint, "http://127.0.0.1:1234/v1/chat/completions");
  assertEquals(lm.apiKey, "lm-studio");
});

Deno.test("Hugging Face and OpenCode Zen use the documented chat-completions hosts", () => {
  const hf = findAiProviderPreset("huggingface");
  assertEquals(hf?.endpoint, "https://router.huggingface.co/v1/chat/completions");
  assertEquals(hf?.keyUrl, "https://huggingface.co/settings/tokens");
  const zen = findAiProviderPreset("opencode-zen");
  assertEquals(zen?.endpoint, "https://opencode.ai/zen/v1/chat/completions");
  const runner = findAiProviderPreset("opencode-cloud");
  assertEquals(runner?.endpoint, "");
  assertEquals(applyAiProviderPreset("opencode-cloud").endpoint, "");
  assert(runner?.help.includes("opencode serve"), runner?.help);
  assert(runner?.help.includes("railway ca desktop --opencode"), runner?.help);
});
