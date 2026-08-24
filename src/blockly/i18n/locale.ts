/**
 * Blockly / application UI locale loading for intEHRgrator.
 * Stock strings: blockly/msg/{lang}. Custom: ./custom_msg.ts
 * Full chrome i18n is deferred; this setting currently drives Blockly messages.
 */
import { Blockly } from "../blockly_core.ts";
import {
  isIntehrLocale,
  msg,
  type IntehrLocale,
  SUPPORTED_LOCALES,
} from "./custom_msg.ts";

export { SUPPORTED_LOCALES, msg, type IntehrLocale, isIntehrLocale };

const STORAGE_KEY = "intehrgrator.blockly.hl";

export function detectLocale(): IntehrLocale {
  try {
    const fromUrl = new URLSearchParams(globalThis.location?.search ?? "").get("hl");
    if (fromUrl && isIntehrLocale(fromUrl)) return fromUrl;
  } catch {
    // no location
  }
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (stored && isIntehrLocale(stored)) return stored;
  } catch {
    // storage flaky
  }
  return "en";
}

export async function loadBlocklyLocale(locale: IntehrLocale): Promise<void> {
  const table = await importBlocklyMsg(locale);
  Blockly.setLocale(table as unknown as Record<string, string>);
  // Merge custom keys into Blockly.Msg for %{BKY_…} style if needed later
  const custom = msg(locale);
  const Msg = (Blockly as unknown as { Msg: Record<string, string> }).Msg;
  if (Msg) {
    Msg["INTEHR_SOURCE_QUERY"] = custom.SOURCE_QUERY;
    Msg["INTEHR_SOURCE_QUERY_TOOLTIP"] = custom.SOURCE_QUERY_TOOLTIP;
    Msg["INTEHR_FOR_EACH_SOURCE_PREFIX"] = custom.FOR_EACH_SOURCE_PREFIX;
    Msg["INTEHR_FOR_EACH_SOURCE_IN"] = custom.FOR_EACH_SOURCE_IN;
    Msg["INTEHR_FOR_EACH_SOURCE_NODES"] = custom.FOR_EACH_SOURCE_NODES;
    Msg["INTEHR_FOR_EACH_SOURCE_DO"] = custom.FOR_EACH_SOURCE_DO;
    Msg["INTEHR_FOR_EACH_SOURCE_TOOLTIP"] = custom.FOR_EACH_SOURCE_TOOLTIP;
  }
}

async function importBlocklyMsg(locale: IntehrLocale): Promise<Record<string, string>> {
  const mod = await (async () => {
    switch (locale) {
      case "sv":
        return await import("blockly/msg/sv");
      case "de":
        return await import("blockly/msg/de");
      case "es":
        return await import("blockly/msg/es");
      case "ca":
        return await import("blockly/msg/ca");
      case "fr":
        return await import("blockly/msg/fr");
      default:
        return await import("blockly/msg/en");
    }
  })();
  // deno-lint-ignore no-explicit-any
  const anyMod = mod as any;
  if (anyMod.default && typeof anyMod.default === "object") return anyMod.default;
  return anyMod as Record<string, string>;
}

/** Persist locale and reload (same pattern as Blockly DevSite demo). */
export function changeLocaleAndReload(
  locale: IntehrLocale,
  workspaceState: unknown,
): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, locale);
    globalThis.sessionStorage?.setItem(
      "intehrgrator.loadOnceBlocks",
      JSON.stringify(workspaceState),
    );
  } catch {
    // storage flaky
  }
  const url = new URL(globalThis.location.href);
  url.searchParams.set("hl", locale);
  globalThis.location.href = url.toString();
}

export function takeLoadOnceBlocks(): unknown | null {
  try {
    const raw = globalThis.sessionStorage?.getItem("intehrgrator.loadOnceBlocks");
    globalThis.sessionStorage?.removeItem("intehrgrator.loadOnceBlocks");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
