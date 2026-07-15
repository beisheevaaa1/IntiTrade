type RecentError = {
  requestId: string;
  method: string;
  path: string;
  message: string;
  occurredAt: string;
};

type StatusCounts = Record<string, number>;

const startedAt = new Date();
let requestCount = 0;
let errorCount = 0;
let totalDurationMs = 0;
let activeSocketConnections = 0;
let socketMessagesSent = 0;
let socketMessageErrors = 0;
const statusCounts: StatusCounts = {};
const recentErrors: RecentError[] = [];
const MAX_RECENT_ERRORS = 50;

export function recordRequest(statusCode: number, durationMs: number) {
  requestCount += 1;
  totalDurationMs += Math.max(0, durationMs);
  const bucket = `${Math.floor(statusCode / 100)}xx`;
  statusCounts[bucket] = (statusCounts[bucket] ?? 0) + 1;
}

export function recordError(error: RecentError) {
  errorCount += 1;
  recentErrors.unshift(error);
  if (recentErrors.length > MAX_RECENT_ERRORS) recentErrors.length = MAX_RECENT_ERRORS;
}

export function recordSocketConnection(delta: 1 | -1) {
  activeSocketConnections = Math.max(0, activeSocketConnections + delta);
}

export function recordSocketMessage(success: boolean) {
  if (success) socketMessagesSent += 1;
  else socketMessageErrors += 1;
}

export function getMonitoringSnapshot() {
  const memory = process.memoryUsage();
  return {
    startedAt: startedAt.toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    requests: {
      total: requestCount,
      errors: errorCount,
      statusCounts: { ...statusCounts },
      averageDurationMs: requestCount === 0 ? 0 : Number((totalDurationMs / requestCount).toFixed(2))
    },
    memory: {
      rssMb: Number((memory.rss / 1024 / 1024).toFixed(1)),
      heapUsedMb: Number((memory.heapUsed / 1024 / 1024).toFixed(1))
    },
    sockets: {
      activeConnections: activeSocketConnections,
      messagesSent: socketMessagesSent,
      messageErrors: socketMessageErrors
    },
    recentErrors: recentErrors.map((error) => ({ ...error }))
  };
}

export function resetMonitoringForTests() {
  requestCount = 0;
  errorCount = 0;
  totalDurationMs = 0;
  activeSocketConnections = 0;
  socketMessagesSent = 0;
  socketMessageErrors = 0;
  for (const key of Object.keys(statusCounts)) delete statusCounts[key];
  recentErrors.length = 0;
}
