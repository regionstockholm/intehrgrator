import { serveDir } from "@std/http/file-server";

export function workbenchHandler(webRoot: string): (req: Request) => Promise<Response> {
  return (req) =>
    serveDir(req, {
      fsRoot: webRoot,
      quiet: true,
      showDirListing: false,
    });
}
