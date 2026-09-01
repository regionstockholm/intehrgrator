import { serveDir } from "@std/http/file-server";
import { join } from "@std/path";

export function workbenchHandler(webRoot: string): (req: Request) => Promise<Response> {
  return async (req) => {
    const html = await tryIndexHtml(webRoot, req);
    if (html) return html;
    const dat = await tryDatAsset(webRoot, req);
    if (dat) return dat;
    return await serveDir(req, {
      fsRoot: webRoot,
      quiet: true,
      showDirListing: false,
    });
  };
}

async function tryIndexHtml(webRoot: string, req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  if (rel === "" || rel === "index.html") {
    try {
      const html = await Deno.readTextFile(join(webRoot, "index.html"));
      const script = "<script>window.__INTEHR_DESKTOP__=true;</script>";
      const injected = /<head[^>]*>/i.test(html)
        ? html.replace(/<head[^>]*>/i, (match) => `${match}${script}`)
        : `${script}${html}`;
      return new Response(injected, { headers: { "content-type": "text/html; charset=utf-8" } });
    } catch {
      return null;
    }
  }
  return null;
}

/** JS is staged as `*.js.dat` so `deno desktop --include` will not execute it. */
async function tryDatAsset(webRoot: string, req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  if (!rel || rel.includes("..")) return null;
  try {
    const bytes = await Deno.readFile(join(webRoot, `${rel}.dat`));
    return new Response(bytes, { headers: { "content-type": contentTypeFor(rel) } });
  } catch {
    return null;
  }
}

function contentTypeFor(rel: string): string {
  if (rel.endsWith(".js") || rel.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (rel.endsWith(".css")) return "text/css; charset=utf-8";
  if (rel.endsWith(".json")) return "application/json; charset=utf-8";
  if (rel.endsWith(".html")) return "text/html; charset=utf-8";
  return "application/octet-stream";
}

export function errorPageHandler(message: string): (req: Request) => Promise<Response> {
  const body =
    `<!doctype html><html><head><meta charset="utf-8"><title>intEHRgrator</title></head>` +
    `<body><h1>intEHRgrator could not start</h1><pre>${escapeHtml(message)}</pre></body></html>`;
  return () =>
    Promise.resolve(
      new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } }),
    );
}

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
