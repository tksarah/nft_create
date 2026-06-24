import { createServer } from "node:http";
import next from "next";

const port = Number(process.argv[2] || process.env.PORT || 3000);
const hostname = "127.0.0.1";
const app = next({ dev: true, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((request, response) => {
  handle(request, response);
});

server.listen(port, hostname, () => {
  console.log(`Ready on http://${hostname}:${port}`);
});

setInterval(() => {}, 2 ** 30);
