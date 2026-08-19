/**
 * ZipEHR RM-type emoji symbols for Target value slot rows.
 * First-listed emoji per type from ehrtslib `serialization/zipehr/symbol_table.ts`.
 */

import { SYMBOL_TABLE_EMOJI_SYMBOLS } from "ehrtslib/serialization/zipehr/symbol_table.ts";
import { baseRmTypeName } from "./rm_meta.ts";

const TABLE = SYMBOL_TABLE_EMOJI_SYMBOLS as Record<string, string>;

export function zipehrEmojiForRmType(rmType: string | undefined): string | undefined {
  if (!rmType) return undefined;
  const base = baseRmTypeName(rmType);
  return TABLE[base] ?? TABLE[rmType];
}
