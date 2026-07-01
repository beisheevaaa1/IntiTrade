import http from "node:http";
import { createApp } from "./app.js";
import { env } from "./env.js";
import { attachSocket } from "./socket.js";

const app = createApp();
const server = http.createServer(app);
attachSocket(server);

server.listen(env.PORT, () => {
  console.log(`API running on http://localhost:${env.PORT}`);
});
