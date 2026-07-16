'use strict';

const http = require('node:http');

const port = Number.parseInt(process.env.SERVER_API_PORT || '4099', 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('SERVER_API_PORT must be between 1 and 65535');
}

const responseBody = JSON.stringify({
  ok: false,
  ready: false,
  maintenance: true,
  code: 'DEPLOYMENT_MAINTENANCE',
});

const server = http.createServer((request, response) => {
  request.resume();
  response.writeHead(503, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Retry-After': '300',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(responseBody);
});

server.on('clientError', (_error, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
});

server.listen(port, '127.0.0.1');

const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
