/** Mock GitHub API + raw.githubusercontent.com for a single-branch repository tree. */
export function mockGithubFetch(files: Record<string, string>): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes("/repos/") && url.includes("/branches/")) {
      return jsonResponse({ commit: { sha: "deadbeef" } });
    }
    if (url.includes("/git/trees/")) {
      return jsonResponse({
        tree: Object.keys(files).map((path) => ({ path, type: "blob" })),
      });
    }
    const raw = url.match(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(.+)$/);
    if (raw) {
      const path = decodeURIComponent(raw[1]!);
      const content = files[path];
      if (content == null) return new Response("missing", { status: 404 });
      return new Response(content, { status: 200 });
    }
    return new Response(`unhandled ${url}`, { status: 500 });
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
