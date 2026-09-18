/**
 * Implicit Mapping Expression names bound on each `for_each_list` iteration.
 *
 * Not workspace Variables. List restriction / quantifiers do not bind these.
 */

/** 0-based index of the current item (`var("item_index")`). */
export function loopIndexBinderName(itemName: string): string {
  return `${itemName}_index`;
}

/** Collection length at loop entry (`var("item_length")`). */
export function loopLengthBinderName(itemName: string): string {
  return `${itemName}_length`;
}
