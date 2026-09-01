import { serveDir } from "@std/http/file-server";
import { join, dirname, fromFileUrl } from "@std/path";

const root = join(dirname(fromFileUrl(import.meta.url)), "..");
const dist = join(root, "dist");

try {
  await Deno.stat(dist);
} catch {
  console.log("dist/ missing — run deno task build first");
  await new Deno.Command("deno", { args: ["task", "build"], cwd: root }).spawn().status;
}

const port = Number(Deno.env.get("PORT") ?? 5173);
console.log(`Serving http://localhost:${port}`);

Deno.serve({ port }, (req) => serveDir(req, { fsRoot: dist, showDirListing: true, enableCors: true, quiet: true }));
