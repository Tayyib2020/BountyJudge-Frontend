import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const root = resolve("dist");
const port = Number.parseInt(process.env.BOUNTYJUDGE_PREVIEW_PORT ?? "5185", 10);
const mimeTypes = { ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".html": "text/html" };

createServer(async (request, response) => {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  const candidate = extname(pathname) ? pathname : "/index.html";
  const file = resolve(root, `.${candidate}`);
  if (file !== root && !file.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": mimeTypes[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`BountyJudge local preview: http://127.0.0.1:${port}/`);
});
