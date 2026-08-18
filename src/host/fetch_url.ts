/** Rewrite user-entered URLs into something `fetch` can load, and derive a filename. */

export function toFetchableUrl(input: string, baseHref?: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("URL is required");

  let href: string;
  try {
    href = baseHref ? new URL(trimmed, baseHref).href : new URL(trimmed).href;
  } catch {
    throw new Error(`Invalid URL: ${trimmed}`);
  }

  const parsed = new URL(href);
  if (parsed.hostname === "github.com" || parsed.hostname === "www.github.com") {
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length >= 5 && (parts[2] === "blob" || parts[2] === "raw")) {
      const [owner, repo, , ref, ...rest] = parts;
      return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${rest.join("/")}`;
    }
  }

  return href;
}

export function assertHttpUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) URLs can be loaded");
  }
}

export function filenameFromUrl(url: string): string {
  const parsed = new URL(url);
  const last = parsed.pathname.split("/").filter(Boolean).pop() ?? "download";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}
