import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { AnnouncementStatus, ListingStatus, Role, TransactionStatus, WantAdStatus } from "@prisma/client";
import { env } from "../env.js";
import { prisma } from "../prisma.js";
import { signAccessToken } from "../utils/auth.js";

const CANONICAL_ORIGIN = "https://intitrade.shop";
const CONFIRMATION = "RUN_INTITRADE_PRODUCTION_TEMP_DATA_SMOKE";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_COOKIE_NAME = "intitrade_session";
const REQUEST_TIMEOUT_MS = 20_000;
const CLEANUP_REQUEST_TIMEOUT_MS = 10_000;
const OVERALL_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_LOCK_FILE = "/run/lock/intitrade-production-smoke.lock";

type JsonRecord = Record<string, unknown>;
type ExpectedStatus = number | readonly number[];

type RequestOptions = {
  method?: string;
  body?: unknown;
  expected?: ExpectedStatus;
  origin?: string | false;
  timeoutMs?: number;
};

type SmokeIdentity = {
  id: string;
  email: string;
  phone: string;
  password: string;
};

type TrackedUpload = {
  ownerId: string;
  filename: string;
  url: string;
};

type TrackedResources = {
  userIds: Set<string>;
  listingIds: Set<string>;
  ticketIds: Set<string>;
  announcementIds: Set<string>;
  wantAdIds: Set<string>;
  reportIds: Set<string>;
  conversationIds: Set<string>;
  messageIds: Set<string>;
  transactionIds: Set<string>;
  reviewIds: Set<string>;
  uploads: TrackedUpload[];
};

type Preconditions = {
  expectedVersion: string;
  uploadsDir: string;
  lockFile: string;
};

type RunLock = {
  path: string;
  nonce: string;
};

type ForeignInteractions = {
  favorites: number;
  conversations: number;
  transactions: number;
  reports: number;
  blocks: number;
  supportMessages: number;
  supportAssignments: number;
};

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function record(value: unknown, label: string): JsonRecord {
  invariant(Boolean(value) && typeof value === "object" && !Array.isArray(value), `${label} was not a JSON object`);
  return value as JsonRecord;
}

function arrayField(value: unknown, key: string, label: string) {
  const candidate = record(value, label)[key];
  invariant(Array.isArray(candidate), `${label}.${key} was not an array`);
  return candidate;
}

function stringField(value: unknown, key: string, label: string) {
  const candidate = record(value, label)[key];
  invariant(typeof candidate === "string" && candidate.length > 0, `${label}.${key} was not a string`);
  return candidate;
}

function statusIsExpected(status: number, expected: ExpectedStatus) {
  return Array.isArray(expected) ? expected.includes(status) : status === expected;
}

function safeApiMessage(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "no JSON error message";
  const message = (value as JsonRecord).message;
  return typeof message === "string" ? message.slice(0, 240) : "no JSON error message";
}

function step(message: string) {
  if (!process.stdout.destroyed) process.stdout.write(`[production-smoke] ${message}\n`);
}

function boundedSignal(parent: AbortSignal | undefined, timeoutMs: number) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return parent ? AbortSignal.any([parent, timeout]) : timeout;
}

function cookiePair(setCookie: string) {
  const pair = setCookie.split(";", 1)[0]?.trim();
  invariant(pair?.startsWith(`${SESSION_COOKIE_NAME}=`), "The API did not set the expected session cookie");
  return pair;
}

function assertSessionCookie(setCookie: string, persistent: boolean) {
  const lower = setCookie.toLowerCase();
  invariant(lower.includes("httponly"), "Session cookie is missing HttpOnly");
  invariant(lower.includes("secure"), "Session cookie is missing Secure");
  invariant(lower.includes("samesite=lax"), "Session cookie is missing SameSite=Lax");
  invariant(lower.includes("path=/"), "Session cookie is missing Path=/");
  invariant(!lower.includes("domain="), "Session cookie must remain host-only");
  invariant(lower.includes("max-age=") === persistent, persistent
    ? "Remember-me session cookie is missing Max-Age"
    : "Session-only cookie unexpectedly has Max-Age");
}

class ApiClient {
  private cookie = "";
  public lastSetCookie = "";

  constructor(
    private readonly abortSignal?: AbortSignal,
    private readonly bearerToken?: string
  ) {}

  forCleanup() {
    const client = new ApiClient(undefined, this.bearerToken);
    client.cookie = this.cookie;
    client.lastSetCookie = this.lastSetCookie;
    return client;
  }

  async request(route: string, options: RequestOptions = {}) {
    const method = options.method ?? "GET";
    const expected = options.expected ?? 200;
    const headers = new Headers({ Accept: "application/json", "Cache-Control": "no-store" });
    if (this.cookie) headers.set("Cookie", this.cookie);
    if (this.bearerToken) headers.set("Authorization", `Bearer ${this.bearerToken}`);
    if (!/^(GET|HEAD|OPTIONS)$/i.test(method) && options.origin !== false) {
      headers.set("Origin", typeof options.origin === "string" ? options.origin : CANONICAL_ORIGIN);
    }

    let body: BodyInit | undefined;
    if (options.body instanceof FormData) {
      body = options.body;
    } else if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.body);
    }

    const response = await fetch(new URL(route, CANONICAL_ORIGIN), {
      method,
      headers,
      body,
      redirect: "manual",
      signal: boundedSignal(this.abortSignal, options.timeoutMs ?? REQUEST_TIMEOUT_MS)
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      this.lastSetCookie = setCookie;
      this.cookie = cookiePair(setCookie);
    }

    const contentType = response.headers.get("content-type") ?? "";
    const value = contentType.includes("application/json") ? await response.json() : null;
    if (!statusIsExpected(response.status, expected)) {
      throw new Error(`${method} ${route} returned ${response.status}; expected ${Array.isArray(expected) ? expected.join("/") : expected} (${safeApiMessage(value)})`);
    }
    return { response, value };
  }
}

function randomPhone(index: number) {
  const suffix = crypto.randomInt(100_000_000, 999_999_999).toString();
  return `+1${index}${suffix}`;
}

function makeIdentity(kind: "probe" | "seller" | "buyer" | "admin", runToken: string, domain: string, phoneIndex: number): SmokeIdentity {
  return {
    id: "",
    email: `intitrade-smoke-${kind}-${runToken}@${domain}`,
    phone: randomPhone(phoneIndex),
    password: crypto.randomBytes(30).toString("base64url")
  };
}

async function verifyPublicApiDatabaseBinding(
  identity: SmokeIdentity,
  tracked: TrackedResources,
  abortSignal: AbortSignal
) {
  step("Proving the public API uses this exact local production database");
  const probe = await prisma.user.create({
    data: {
      name: "IntiTrade production smoke binding probe",
      email: identity.email,
      phone: identity.phone,
      passwordHash: await bcrypt.hash(identity.password, 12),
      role: Role.STUDENT,
      isVerified: true
    },
    select: { id: true, email: true, role: true, tokenVersion: true }
  });
  identity.id = probe.id;
  tracked.userIds.add(probe.id);

  try {
    const token = signAccessToken({ id: probe.id, role: probe.role, tokenVersion: probe.tokenVersion });
    const publicProbe = await new ApiClient(abortSignal, token).request("/api/auth/me");
    const publicUser = record(record(publicProbe.value, "database binding response").user, "database binding user");
    invariant(publicUser.id === probe.id && publicUser.email === probe.email,
      "The public API is not connected to the local production database; no public writes were attempted");
  } finally {
    await prisma.user.deleteMany({ where: { id: probe.id, email: probe.email } });
  }
}

function validatePreconditions() {
  invariant(process.env.PRODUCTION_SMOKE_CONFIRM === CONFIRMATION,
    `Refusing to run. Set PRODUCTION_SMOKE_CONFIRM=${CONFIRMATION} explicitly.`);
  invariant(env.NODE_ENV === "production", "Refusing to run outside NODE_ENV=production");
  invariant(env.EMAIL_VERIFICATION_REQUIRED === false,
    "Refusing to create test accounts while email verification is enabled; the smoke test must not send email");
  invariant(process.env.PRODUCTION_SMOKE_BASE_URL === CANONICAL_ORIGIN,
    `Refusing to run unless PRODUCTION_SMOKE_BASE_URL is exactly ${CANONICAL_ORIGIN}`);

  const expectedVersion = process.env.PRODUCTION_SMOKE_EXPECTED_VERSION?.trim();
  invariant(Boolean(expectedVersion) && /^[0-9a-f]{7,40}$/i.test(expectedVersion!),
    "PRODUCTION_SMOKE_EXPECTED_VERSION must be the exact deployed Git revision");
  invariant(env.APP_VERSION === expectedVersion,
    "The local production environment version does not match PRODUCTION_SMOKE_EXPECTED_VERSION");

  invariant(Boolean(env.DATABASE_URL), "DATABASE_URL is required");
  const databaseUrl = new URL(env.DATABASE_URL!);
  invariant(["localhost", "127.0.0.1", "[::1]"].includes(databaseUrl.hostname),
    "Refusing to run unless DATABASE_URL points to the production host's local PostgreSQL service");

  const configuredUploadsDir = process.env.PRODUCTION_SMOKE_UPLOADS_DIR;
  invariant(Boolean(configuredUploadsDir) && path.isAbsolute(configuredUploadsDir!),
    "PRODUCTION_SMOKE_UPLOADS_DIR must be an explicit absolute path");
  const uploadsDir = fs.realpathSync(configuredUploadsDir!);
  invariant(path.basename(uploadsDir) === "uploads" && uploadsDir !== path.parse(uploadsDir).root,
    "PRODUCTION_SMOKE_UPLOADS_DIR must resolve to the backend uploads directory");
  invariant(fs.statSync(uploadsDir).isDirectory(), "PRODUCTION_SMOKE_UPLOADS_DIR is not a directory");

  const lockFile = process.env.PRODUCTION_SMOKE_LOCK_FILE?.trim() || DEFAULT_LOCK_FILE;
  invariant(path.isAbsolute(lockFile) && path.basename(lockFile) === "intitrade-production-smoke.lock",
    "PRODUCTION_SMOKE_LOCK_FILE must be an absolute intitrade-production-smoke.lock path");
  const lockParent = fs.realpathSync(path.dirname(lockFile));
  invariant(lockParent !== path.parse(lockParent).root, "The production smoke lock cannot be placed at the filesystem root");

  return { expectedVersion: expectedVersion!, uploadsDir, lockFile } satisfies Preconditions;
}

function processIsRunning(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EPERM") return true;
    if (code === "ESRCH") return false;
    throw error;
  }
}

function parseLockRecord(raw: string) {
  try {
    const value = record(JSON.parse(raw), "production smoke lock");
    const pid = value.pid;
    const nonce = value.nonce;
    if (typeof pid !== "number" || !Number.isSafeInteger(pid) || pid <= 0 || typeof nonce !== "string" || !nonce) return null;
    return { pid, nonce };
  } catch {
    return null;
  }
}

function acquireRunLock(lockFile: string, expectedVersion: string): RunLock {
  const nonce = crypto.randomUUID();
  const payload = JSON.stringify({ pid: process.pid, nonce, expectedVersion, startedAt: new Date().toISOString() });

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const handle = fs.openSync(lockFile, "wx", 0o600);
      try {
        fs.writeFileSync(handle, payload, { encoding: "utf8" });
        fs.fsyncSync(handle);
      } finally {
        fs.closeSync(handle);
      }
      return { path: lockFile, nonce };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;

      const stat = fs.lstatSync(lockFile);
      invariant(stat.isFile() && !stat.isSymbolicLink(), `Refusing to replace a non-regular production smoke lock: ${lockFile}`);
      const currentUid = process.getuid?.();
      invariant(currentUid === undefined || stat.uid === currentUid,
        "The existing production smoke lock belongs to another operating-system user");
      const existingRaw = fs.readFileSync(lockFile, "utf8");
      const existing = parseLockRecord(existingRaw);
      if (existing && processIsRunning(existing.pid)) {
        throw new Error(`Another production smoke process is active with PID ${existing.pid}`);
      }
      if (!existing && Date.now() - stat.mtimeMs < 30_000) {
        throw new Error("A new or incomplete production smoke lock exists; wait 30 seconds before stale recovery");
      }

      const quarantine = `${lockFile}.${process.pid}.${crypto.randomUUID()}.stale`;
      try {
        fs.renameSync(lockFile, quarantine);
      } catch (renameError) {
        if ((renameError as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw renameError;
      }
      const movedRaw = fs.readFileSync(quarantine, "utf8");
      if (movedRaw !== existingRaw) {
        if (!fs.existsSync(lockFile)) fs.renameSync(quarantine, lockFile);
        throw new Error("The production smoke lock changed during stale-lock recovery");
      }
      fs.unlinkSync(quarantine);
      step("Recovered a stale same-host production smoke lock");
    }
  }
  throw new Error("Could not acquire the same-host production smoke lock");
}

function releaseRunLock(lock?: RunLock) {
  if (!lock || !fs.existsSync(lock.path)) return;
  const current = parseLockRecord(fs.readFileSync(lock.path, "utf8"));
  if (current?.nonce === lock.nonce) fs.unlinkSync(lock.path);
}

async function register(client: ApiClient, identity: SmokeIdentity, kind: string, tracked: TrackedResources) {
  const result = await client.request("/api/auth/register", {
    method: "POST",
    expected: 201,
    body: {
      name: `IntiTrade smoke ${kind}`,
      email: identity.email,
      phone: identity.phone,
      password: identity.password
    }
  });
  const user = record(record(result.value, "registration").user, "registration.user");
  const id = stringField(user, "id", "registration.user");
  invariant(UUID_PATTERN.test(id), "Registration returned an invalid user id");
  identity.id = id;
  tracked.userIds.add(id);

  const persisted = await prisma.user.findUnique({ where: { email: identity.email }, select: { id: true } });
  invariant(persisted?.id === id, "The public API and local production database do not reference the same account");
}

async function login(client: ApiClient, identity: SmokeIdentity, persistent = false) {
  const result = await client.request("/api/auth/login", {
    method: "POST",
    body: { email: identity.email, password: identity.password, rememberMe: persistent }
  });
  const user = record(record(result.value, "login").user, "login.user");
  invariant(user.id === identity.id, "Login returned the wrong temporary user");
  assertSessionCookie(client.lastSetCookie, persistent);
  return user;
}

function includesId(items: unknown[], id: string) {
  return items.some((item) => Boolean(item) && typeof item === "object" && !Array.isArray(item) && (item as JsonRecord).id === id);
}

function uploadForm(bytes: Uint8Array, filename: string) {
  const form = new FormData();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  form.append("file", new Blob([copy.buffer], { type: "image/png" }), filename);
  return form;
}

async function removeSharedTicketNotifications(ticketId: string, temporaryUserIds: string[]) {
  await prisma.notification.deleteMany({
    where: {
      userId: { notIn: temporaryUserIds },
      type: { in: ["SUPPORT_TICKET_CREATED", "SUPPORT_TICKET_MESSAGE"] },
      payload: JSON.stringify({ ticketId })
    }
  });
}

async function discoverOwnedResources(identities: SmokeIdentity[], tracked: TrackedResources) {
  const emails = identities.map((identity) => identity.email);
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  users.forEach((user) => tracked.userIds.add(user.id));
  const userIds = [...tracked.userIds];
  if (!userIds.length) return;

  const [listings, tickets, announcements, wantAds] = await Promise.all([
    prisma.listing.findMany({ where: { sellerId: { in: userIds } }, select: { id: true } }),
    prisma.supportTicket.findMany({ where: { userId: { in: userIds } }, select: { id: true } }),
    prisma.announcement.findMany({ where: { authorId: { in: userIds } }, select: { id: true } }),
    prisma.wantAd.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
  ]);
  listings.forEach((listing) => tracked.listingIds.add(listing.id));
  tickets.forEach((ticket) => tracked.ticketIds.add(ticket.id));
  announcements.forEach((announcement) => tracked.announcementIds.add(announcement.id));
  wantAds.forEach((wantAd) => tracked.wantAdIds.add(wantAd.id));

  const listingIds = [...tracked.listingIds];
  const [conversations, transactions, reports] = await Promise.all([
    prisma.conversation.findMany({
      where: {
        OR: [
          { buyerId: { in: userIds } },
          { sellerId: { in: userIds } },
          ...(listingIds.length ? [{ listingId: { in: listingIds } }] : [])
        ]
      },
      select: { id: true }
    }),
    prisma.transaction.findMany({
      where: {
        OR: [
          { buyerId: { in: userIds } },
          { sellerId: { in: userIds } },
          ...(listingIds.length ? [{ listingId: { in: listingIds } }] : [])
        ]
      },
      select: { id: true }
    }),
    prisma.report.findMany({
      where: {
        OR: [
          { reporterId: { in: userIds } },
          ...(listingIds.length ? [{ listingId: { in: listingIds } }] : [])
        ]
      },
      select: { id: true }
    })
  ]);
  conversations.forEach((conversation) => tracked.conversationIds.add(conversation.id));
  transactions.forEach((transaction) => tracked.transactionIds.add(transaction.id));
  reports.forEach((report) => tracked.reportIds.add(report.id));
}

async function freezeTemporaryResources(tracked: TrackedResources) {
  const userIds = [...tracked.userIds];
  if (!userIds.length) return;
  // Demote the temporary administrator first so a later cleanup failure cannot
  // leave an active privileged account behind.
  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: {
      role: Role.STUDENT,
      showEmail: false,
      showCampusArea: false,
      showOnlineStatus: false,
      allowMessages: false,
      avatarUrl: null
    }
  });
  await prisma.$transaction(async (tx) => {
    // A reservation must be released before archiving its listing: the
    // database deliberately rejects closing a listing with an active hold.
    await tx.transaction.updateMany({
      where: {
        OR: [{ buyerId: { in: userIds } }, { sellerId: { in: userIds } }],
        status: { in: [TransactionStatus.RESERVED, TransactionStatus.DISPUTED] }
      },
      data: { status: TransactionStatus.CANCELLED, cancelledAt: new Date() }
    });
    await tx.listing.updateMany({
      where: { sellerId: { in: userIds } },
      data: { status: ListingStatus.ARCHIVED, showPhone: false }
    });
    await tx.announcement.updateMany({
      where: { authorId: { in: userIds } },
      data: { status: AnnouncementStatus.EXPIRED, imageUrl: null }
    });
    await tx.wantAd.updateMany({
      where: { userId: { in: userIds } },
      data: { status: WantAdStatus.CLOSED }
    });
    await tx.supportTicket.updateMany({
      where: { userId: { in: userIds } },
      data: { status: "CLOSED", resolvedAt: new Date() }
    });
  });
}

async function findForeignInteractions(tracked: TrackedResources): Promise<ForeignInteractions> {
  const userIds = [...tracked.userIds];
  const listingIds = [...tracked.listingIds];
  const ticketIds = [...tracked.ticketIds];
  const zero: ForeignInteractions = {
    favorites: 0,
    conversations: 0,
    transactions: 0,
    reports: 0,
    blocks: 0,
    supportMessages: 0,
    supportAssignments: 0
  };
  if (!userIds.length) return zero;

  const [favorites, conversations, transactions, reports, blocks, supportMessages, supportAssignments] = await Promise.all([
    listingIds.length
      ? prisma.favorite.count({ where: { listingId: { in: listingIds }, userId: { notIn: userIds } } })
      : 0,
    listingIds.length
      ? prisma.conversation.count({
          where: {
            listingId: { in: listingIds },
            OR: [{ buyerId: { notIn: userIds } }, { sellerId: { notIn: userIds } }]
          }
        })
      : 0,
    listingIds.length
      ? prisma.transaction.count({
          where: {
            listingId: { in: listingIds },
            OR: [{ buyerId: { notIn: userIds } }, { sellerId: { notIn: userIds } }]
          }
        })
      : 0,
    listingIds.length
      ? prisma.report.count({ where: { listingId: { in: listingIds }, reporterId: { notIn: userIds } } })
      : 0,
    prisma.userBlock.count({
      where: {
        OR: [
          { blockerId: { in: userIds }, blockedId: { notIn: userIds } },
          { blockedId: { in: userIds }, blockerId: { notIn: userIds } }
        ]
      }
    }),
    ticketIds.length
      ? prisma.supportTicketMessage.count({
          where: {
            ticketId: { in: ticketIds },
            OR: [{ authorId: null }, { authorId: { notIn: userIds } }]
          }
        })
      : 0,
    ticketIds.length
      ? prisma.supportTicket.count({
          where: {
            OR: [
              { id: { in: ticketIds }, assignedAdminId: { not: null, notIn: userIds } },
              { assignedAdminId: { in: userIds }, userId: { notIn: userIds } }
            ]
          }
        })
      : prisma.supportTicket.count({
          where: { assignedAdminId: { in: userIds }, userId: { notIn: userIds } }
        })
  ]);
  return { favorites, conversations, transactions, reports, blocks, supportMessages, supportAssignments };
}

function foreignInteractionCount(interactions: ForeignInteractions) {
  return Object.values(interactions).reduce((total, count) => total + count, 0);
}

async function quarantineTemporaryAccounts(tracked: TrackedResources, interactions: ForeignInteractions) {
  const userIds = [...tracked.userIds];
  if (userIds.length) {
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { role: Role.STUDENT, isBlocked: true, tokenVersion: { increment: 1 }, allowMessages: false }
    });
  }
  throw new Error(
    `Foreign production activity touched temporary resources; accounts were demoted/blocked and fixtures were archived without cascading deletion (${JSON.stringify(interactions)})`
  );
}

async function ensureNoForeignInteractions(tracked: TrackedResources) {
  const interactions = await findForeignInteractions(tracked);
  if (foreignInteractionCount(interactions) > 0) {
    await quarantineTemporaryAccounts(tracked, interactions);
  }
}

async function cleanupTemporaryData(
  identities: SmokeIdentity[],
  tracked: TrackedResources,
  uploadsDir: string,
  ownerClients: Map<string, ApiClient>
) {
  step("Cleaning temporary data");
  await discoverOwnedResources(identities, tracked);
  const emails = identities.map((identity) => identity.email);
  const userIds = [...tracked.userIds];
  await freezeTemporaryResources(tracked);
  await ensureNoForeignInteractions(tracked);

  for (const ticketId of tracked.ticketIds) {
    await removeSharedTicketNotifications(ticketId, userIds);
  }
  if (userIds.length || emails.length) {
    await prisma.adminActionLog.deleteMany({
      where: {
        OR: [
          ...(userIds.length ? [{ adminId: { in: userIds } }] : []),
          { actorEmail: { in: emails } }
        ]
      }
    });
  }

  await ensureNoForeignInteractions(tracked);
  if (userIds.length) {
    await prisma.$transaction([
      prisma.supportTicket.deleteMany({ where: { userId: { in: userIds } } }),
      prisma.announcement.deleteMany({ where: { authorId: { in: userIds } } }),
      prisma.wantAd.deleteMany({ where: { userId: { in: userIds } } }),
      prisma.listing.deleteMany({ where: { sellerId: { in: userIds } } })
    ]);
  }

  for (const upload of tracked.uploads) {
    const ownerClient = ownerClients.get(upload.ownerId);
    if (!ownerClient) continue;
    try {
      await ownerClient.forCleanup().request(`/api/uploads/${encodeURIComponent(upload.filename)}`, {
        method: "DELETE",
        expected: 204,
        timeoutMs: CLEANUP_REQUEST_TIMEOUT_MS
      });
    } catch {
      // The exact filesystem fallback below is authoritative when the API is unavailable.
    }
  }

  if (fs.existsSync(uploadsDir)) {
    const entries = await fs.promises.readdir(uploadsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ownerId = userIds.find((id) => entry.name.startsWith(`${id}-`));
      if (!ownerId) continue;
      const candidate = path.join(uploadsDir, entry.name);
      invariant(path.dirname(candidate) === uploadsDir, "Refusing an upload cleanup path outside the configured directory");
      await fs.promises.unlink(candidate).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }

  await ensureNoForeignInteractions(tracked);
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  const listingIds = [...tracked.listingIds];
  const conversationIds = [...tracked.conversationIds];
  const transactionIds = [...tracked.transactionIds];
  const ticketIds = [...tracked.ticketIds];
  const remaining = await Promise.all([
    prisma.user.count({ where: { email: { in: emails } } }),
    prisma.emailVerificationToken.count({ where: { userId: { in: userIds } } }),
    prisma.listing.count({ where: { sellerId: { in: userIds } } }),
    prisma.listingImage.count({ where: { listingId: { in: listingIds } } }),
    prisma.favorite.count({ where: { OR: [{ userId: { in: userIds } }, { listingId: { in: listingIds } }] } }),
    prisma.conversation.count({
      where: { OR: [{ buyerId: { in: userIds } }, { sellerId: { in: userIds } }, { listingId: { in: listingIds } }] }
    }),
    prisma.message.count({ where: { OR: [{ senderId: { in: userIds } }, { conversationId: { in: conversationIds } }] } }),
    prisma.report.count({ where: { OR: [{ reporterId: { in: userIds } }, { listingId: { in: listingIds } }] } }),
    prisma.transaction.count({
      where: { OR: [{ buyerId: { in: userIds } }, { sellerId: { in: userIds } }, { listingId: { in: listingIds } }] }
    }),
    prisma.review.count({
      where: { OR: [{ reviewerId: { in: userIds } }, { revieweeId: { in: userIds } }, { transactionId: { in: transactionIds } }] }
    }),
    prisma.userBlock.count({ where: { OR: [{ blockerId: { in: userIds } }, { blockedId: { in: userIds } }] } }),
    prisma.notification.count({ where: { userId: { in: userIds } } }),
    prisma.supportTicket.count({
      where: { OR: [{ userId: { in: userIds } }, { assignedAdminId: { in: userIds } }, { id: { in: ticketIds } }] }
    }),
    prisma.supportTicketMessage.count({
      where: { OR: [{ authorId: { in: userIds } }, { ticketId: { in: ticketIds } }] }
    }),
    prisma.announcement.count({ where: { authorId: { in: userIds } } }),
    prisma.wantAd.count({ where: { userId: { in: userIds } } }),
    prisma.adminActionLog.count({
      where: {
        OR: [
          { adminId: { in: userIds } },
          { actorEmail: { in: emails } },
        ]
      }
    }),
    ticketIds.length
      ? prisma.notification.count({
          where: {
            userId: { notIn: userIds },
            type: { in: ["SUPPORT_TICKET_CREATED", "SUPPORT_TICKET_MESSAGE"] },
            OR: ticketIds.map((ticketId) => ({ payload: JSON.stringify({ ticketId }) }))
          }
        })
      : 0
  ]);
  invariant(remaining.every((count) => count === 0), "Temporary database cascade cleanup verification failed");
  if (fs.existsSync(uploadsDir) && userIds.length) {
    const remainingFiles = (await fs.promises.readdir(uploadsDir)).filter((name) => userIds.some((id) => name.startsWith(`${id}-`)));
    invariant(remainingFiles.length === 0, "Temporary upload cleanup verification failed");
  }
  step("Temporary data cleanup verified");
}

async function runSmoke(abortSignal: AbortSignal, { expectedVersion, uploadsDir }: Preconditions) {
  const runToken = crypto.randomUUID().replaceAll("-", "");
  const marker = `IntiTrade production smoke ${runToken}`;
  const allowedDomains = env.ALLOWED_EMAIL_DOMAINS.split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
  const domain = allowedDomains[0] || env.ALLOWED_EMAIL_DOMAIN?.trim().toLowerCase().replace(/^@/, "") || "example.invalid";
  const identities = [
    makeIdentity("seller", runToken, domain, 6),
    makeIdentity("buyer", runToken, domain, 7),
    makeIdentity("admin", runToken, domain, 8)
  ];
  const invalidIdentity: SmokeIdentity = {
    id: "",
    email: `intitrade-smoke-invalid-${runToken}@${domain}`,
    phone: randomPhone(5),
    password: "short"
  };
  const probeIdentity = makeIdentity("probe", runToken, domain, 9);
  const cleanupIdentities = [...identities, invalidIdentity, probeIdentity];
  const [seller, buyer, admin] = identities;
  const sellerClient = new ApiClient(abortSignal);
  const buyerClient = new ApiClient(abortSignal);
  const adminClient = new ApiClient(abortSignal);
  const anonymousClient = new ApiClient(abortSignal);
  const ownerClients = new Map<string, ApiClient>();
  const tracked: TrackedResources = {
    userIds: new Set(),
    listingIds: new Set(),
    ticketIds: new Set(),
    announcementIds: new Set(),
    wantAdIds: new Set(),
    reportIds: new Set(),
    conversationIds: new Set(),
    messageIds: new Set(),
    transactionIds: new Set(),
    reviewIds: new Set(),
    uploads: []
  };

  const cleanupEmails = cleanupIdentities.map((identity) => identity.email);
  const preexistingUsers = await prisma.user.count({ where: { email: { in: cleanupEmails } } });
  invariant(preexistingUsers === 0,
    "The generated smoke-test namespace already exists; refusing to risk deleting pre-existing data");

  let failure: unknown;
  try {
    step("Checking public readiness and discovery endpoints");
    const readyResult = await anonymousClient.request("/api/health/ready");
    const ready = record(readyResult.value, "readiness");
    invariant(ready.ok === true && ready.ready === true, "Production readiness did not report ok/ready");
    invariant(ready.version === expectedVersion, "Public readiness version does not match the expected deployment");
    const categoryResult = await anonymousClient.request("/api/listings/categories");
    const categories = arrayField(categoryResult.value, "categories", "categories");
    invariant(categories.length > 0, "No listing category is available for the smoke test");
    const category = record(categories[0], "category");
    const categoryId = stringField(category, "id", "category");
    const categorySlug = stringField(category, "slug", "category");
    invariant(UUID_PATTERN.test(categoryId), "The selected category id is invalid");
    const publicCategoryKeys = categories.map((item) => {
      const candidate = record(item, "category");
      return `${stringField(candidate, "id", "category")}:${stringField(candidate, "slug", "category")}`;
    }).sort();
    const localCategoryKeys = (await prisma.category.findMany({ select: { id: true, slug: true } }))
      .map((item) => `${item.id}:${item.slug}`)
      .sort();
    invariant(JSON.stringify(publicCategoryKeys) === JSON.stringify(localCategoryKeys),
      "The public API category set does not match the local production database; refusing to create data");
    await verifyPublicApiDatabaseBinding(probeIdentity, tracked, abortSignal);

    step("Checking registration validation and creating temporary accounts");
    await anonymousClient.request("/api/auth/register", {
      method: "POST",
      expected: 400,
      body: { name: "Smoke invalid", email: invalidIdentity.email, phone: invalidIdentity.phone, password: invalidIdentity.password }
    });
    await register(sellerClient, seller, "seller", tracked);
    await register(buyerClient, buyer, "buyer", tracked);
    await register(adminClient, admin, "admin", tracked);
    ownerClients.set(seller.id, sellerClient);
    ownerClients.set(buyer.id, buyerClient);
    ownerClients.set(admin.id, adminClient);

    await prisma.$transaction([
      prisma.user.update({ where: { id: seller.id }, data: { isVerified: true } }),
      prisma.user.update({ where: { id: buyer.id }, data: { isVerified: true } }),
      prisma.user.update({ where: { id: admin.id }, data: { isVerified: true, role: Role.ADMIN } })
    ]);

    const sellerLogin = await login(sellerClient, seller, false);
    const buyerLogin = await login(buyerClient, buyer, true);
    const adminLogin = await login(adminClient, admin, false);
    invariant(sellerLogin.role === "STUDENT" && buyerLogin.role === "STUDENT", "Temporary marketplace users have the wrong role");
    invariant(adminLogin.role === "ADMIN", "Temporary administrator promotion was not reflected by login");
    await sellerClient.request("/api/auth/me");
    await buyerClient.request("/api/auth/me");
    await adminClient.request("/api/auth/me");

    step("Checking cookie-origin protection and seller profile controls");
    await buyerClient.request("/api/auth/profile", { method: "PATCH", body: { name: "Blocked missing origin" }, expected: 403, origin: false });
    await buyerClient.request("/api/auth/profile", { method: "PATCH", body: { name: "Blocked foreign origin" }, expected: 403, origin: "https://attacker.invalid" });
    await sellerClient.request("/api/auth/profile", {
      method: "PATCH",
      body: { sellerType: "SHOP", showEmail: false, showCampusArea: true, allowMessages: true }
    });

    step("Checking media validation, ownership, storage, and public delivery");
    await sellerClient.request("/api/uploads", {
      method: "POST",
      expected: 400,
      body: uploadForm(Buffer.from("not an image", "utf8"), `${runToken}-invalid.png`)
    });
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n0kAAAAASUVORK5CYII=", "base64");
    const uploadResult = await sellerClient.request("/api/uploads", {
      method: "POST",
      expected: 201,
      body: uploadForm(png, `${runToken}.png`)
    });
    const uploadUrl = stringField(uploadResult.value, "url", "upload");
    const uploadMatch = /^\/uploads\/([a-zA-Z0-9._-]+\.png)$/.exec(uploadUrl);
    invariant(uploadMatch && uploadMatch[1].startsWith(`${seller.id}-`), "Upload filename is not scoped to the temporary seller");
    const upload: TrackedUpload = { ownerId: seller.id, filename: uploadMatch[1], url: uploadUrl };
    tracked.uploads.push(upload);
    invariant(fs.existsSync(path.join(uploadsDir, upload.filename)), "The API upload did not appear in the explicitly configured uploads directory");
    const publicUpload = await fetch(`${CANONICAL_ORIGIN}${upload.url}?smoke=${runToken}`, {
      headers: { "Cache-Control": "no-store" },
      redirect: "manual",
      signal: boundedSignal(abortSignal, REQUEST_TIMEOUT_MS)
    });
    invariant(publicUpload.status === 200 && (publicUpload.headers.get("content-type") ?? "").includes("image/png"),
      "The uploaded image was not publicly served as PNG");
    await publicUpload.arrayBuffer();

    const listingPayload = {
      title: marker,
      description: `${marker} validates moderation, inventory, search, and contact privacy.`,
      price: 37.5,
      type: "PRODUCT",
      condition: "GOOD",
      location: "INTI production smoke test",
      quantity: 2,
      isNegotiable: true,
      showPhone: false,
      categoryId,
      imageUrls: [upload.url]
    };
    await buyerClient.request("/api/listings", { method: "POST", body: listingPayload, expected: 403 });

    step("Checking listing moderation, ownership, contact privacy, and advanced search");
    const listingResult = await sellerClient.request("/api/listings", { method: "POST", expected: 201, body: listingPayload });
    const listing = record(record(listingResult.value, "listing response").listing, "listing");
    const listingId = stringField(listing, "id", "listing");
    tracked.listingIds.add(listingId);
    invariant(listing.status === "PENDING", "A new listing bypassed admin moderation");
    await anonymousClient.request(`/api/listings/${listingId}`, { expected: 404 });
    const mineResult = await sellerClient.request("/api/listings/mine");
    invariant(includesId(arrayField(mineResult.value, "listings", "my listings"), listingId), "Seller cannot see the pending listing");
    await buyerClient.request(`/api/listings/${listingId}`, { method: "PATCH", expected: 403, body: { title: `${marker} changed` } });
    await adminClient.request(`/api/admin/listings/${listingId}/status`, { method: "PATCH", expected: 400, body: { status: "REJECTED" } });
    await adminClient.request(`/api/admin/listings/${listingId}/status`, { method: "PATCH", body: { status: "ACTIVE" } });

    const privatePhoneListing = record(record((await anonymousClient.request(`/api/listings/${listingId}`)).value, "public listing response").listing, "public listing");
    const privateSeller = record(privatePhoneListing.seller, "public listing seller");
    invariant(privateSeller.phone === undefined, "Seller phone leaked while showPhone was disabled");
    const searchRoute = `/api/listings?q=${encodeURIComponent(runToken)}&category=${encodeURIComponent(`${categorySlug},not-a-real-category`)}&type=PRODUCT&sellerType=SHOP&minPrice=1&maxPrice=100&sort=price_asc`;
    const searchResult = await anonymousClient.request(searchRoute);
    invariant(includesId(arrayField(searchResult.value, "listings", "advanced listing search"), listingId), "Advanced multi-category search did not return the approved listing");
    const autocomplete = await anonymousClient.request(`/api/listings/autocomplete?q=${encodeURIComponent(runToken.slice(0, 12))}`);
    invariant(arrayField(autocomplete.value, "suggestions", "autocomplete").includes(marker), "Autocomplete did not return the approved listing");

    const pendingPhoneUpdate = await sellerClient.request(`/api/listings/${listingId}`, { method: "PATCH", body: { showPhone: true } });
    invariant(record(record(pendingPhoneUpdate.value, "listing update").listing, "updated listing").status === "PENDING",
      "A seller edit bypassed renewed moderation");
    await anonymousClient.request(`/api/listings/${listingId}`, { expected: 404 });
    await adminClient.request(`/api/admin/listings/${listingId}/status`, { method: "PATCH", body: { status: "ACTIVE" } });
    const phoneListing = record(record((await anonymousClient.request(`/api/listings/${listingId}`)).value, "public listing response").listing, "public listing");
    invariant(record(phoneListing.seller, "public listing seller").phone === seller.phone, "Seller phone was not shown after explicit opt-in and reapproval");
    await sellerClient.request(`/api/uploads/${encodeURIComponent(upload.filename)}`, { method: "DELETE", expected: 409 });

    step("Checking favorites, reports, messages, blocking, and read state");
    await buyerClient.request(`/api/favorites/${listingId}`, { method: "POST", expected: 201 });
    const favorites = await buyerClient.request("/api/favorites");
    const favoriteItems = arrayField(favorites.value, "favorites", "favorites");
    invariant(favoriteItems.some((item) => record(record(item, "favorite").listing, "favorite.listing").id === listingId), "Favorite was not listed");
    await buyerClient.request(`/api/favorites/${listingId}`, { method: "DELETE", expected: 204 });

    const reportResult = await buyerClient.request("/api/reports", {
      method: "POST",
      expected: 201,
      body: { listingId, reason: "Smoke verification", details: marker }
    });
    const reportId = stringField(record(reportResult.value, "report response").report, "id", "report");
    tracked.reportIds.add(reportId);
    const adminReports = await adminClient.request("/api/admin/reports");
    invariant(includesId(arrayField(adminReports.value, "reports", "admin reports"), reportId), "Admin cannot see the temporary report");
    await adminClient.request(`/api/admin/reports/${reportId}`, { method: "PATCH", body: { status: "REVIEWED" } });

    const conversationResult = await buyerClient.request("/api/conversations", {
      method: "POST",
      expected: 201,
      body: { listingId }
    });
    const conversation = record(record(conversationResult.value, "conversation response").conversation, "conversation");
    const conversationId = stringField(conversation, "id", "conversation");
    tracked.conversationIds.add(conversationId);
    const messageResult = await buyerClient.request(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      expected: 201,
      body: { body: marker }
    });
    const messageId = stringField(record(messageResult.value, "message response").message, "id", "message");
    tracked.messageIds.add(messageId);
    await sellerClient.request(`/api/conversations/${conversationId}/read`, { method: "PATCH", expected: 204 });
    await buyerClient.request(`/api/community/blocks/${seller.id}`, {
      method: "POST",
      expected: 201,
      body: { reason: "Production smoke block check" }
    });
    await buyerClient.request(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      expected: 403,
      body: { body: `${marker} blocked` }
    });
    await buyerClient.request(`/api/community/blocks/${seller.id}`, { method: "DELETE", expected: 204 });
    await buyerClient.request(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      expected: 201,
      body: { body: `${marker} unblocked` }
    });

    step("Checking reservation OTP, inventory completion, reviews, and rating search");
    const reservationResult = await buyerClient.request("/api/transactions", {
      method: "POST",
      expected: 201,
      body: { listingId, quantity: 1 }
    });
    const reservation = record(record(reservationResult.value, "reservation response").transaction, "reservation");
    const transactionId = stringField(reservation, "id", "reservation");
    const otpCode = stringField(reservation, "otpCode", "reservation");
    tracked.transactionIds.add(transactionId);
    invariant(/^\d{6}$/.test(otpCode), "Buyer did not receive a valid reservation OTP");
    const sellerTransactions = await sellerClient.request("/api/transactions");
    const sellerReservation = arrayField(sellerTransactions.value, "transactions", "seller transactions")
      .map((item) => record(item, "seller transaction"))
      .find((item) => item.id === transactionId);
    invariant(sellerReservation && sellerReservation.otpCode === undefined, "Reservation OTP leaked to the seller");
    await sellerClient.request(`/api/transactions/${transactionId}/status`, {
      method: "PATCH",
      expected: 400,
      body: { status: "COMPLETED", otpCode: "000000" }
    });
    await sellerClient.request(`/api/transactions/${transactionId}/status`, {
      method: "PATCH",
      body: { status: "COMPLETED", otpCode }
    });
    const reviewResult = await buyerClient.request(`/api/transactions/${transactionId}/review`, {
      method: "POST",
      expected: 201,
      body: { rating: 5, comment: marker }
    });
    const reviewId = stringField(record(reviewResult.value, "review response").review, "id", "review");
    tracked.reviewIds.add(reviewId);
    const reviewsResult = await anonymousClient.request(`/api/transactions/seller/${seller.id}/reviews`);
    const reviewSummary = record(record(reviewsResult.value, "seller reviews").summary, "review summary");
    invariant(reviewSummary.average === 5 && reviewSummary.count === 1, "Seller rating summary is incorrect");
    const ratedSearch = await anonymousClient.request(`/api/listings?q=${encodeURIComponent(runToken)}&minRating=4`);
    invariant(includesId(arrayField(ratedSearch.value, "listings", "rating search"), listingId), "Minimum-rating search did not return the reviewed seller");
    const adminReviews = await adminClient.request("/api/admin/reviews");
    invariant(includesId(arrayField(adminReviews.value, "reviews", "admin reviews"), reviewId), "Admin cannot see the temporary review");

    step("Checking buyer disputes and admin cancellation resolution");
    const disputedReservationResult = await buyerClient.request("/api/transactions", {
      method: "POST",
      expected: 201,
      body: { listingId, quantity: 1 }
    });
    const disputedReservation = record(
      record(disputedReservationResult.value, "disputed reservation response").transaction,
      "disputed reservation"
    );
    const disputedTransactionId = stringField(disputedReservation, "id", "disputed reservation");
    tracked.transactionIds.add(disputedTransactionId);
    await sellerClient.request(`/api/listings/${listingId}/status`, {
      method: "PATCH",
      expected: 409,
      body: { status: "ARCHIVED" }
    });
    const disputeResult = await buyerClient.request(`/api/transactions/${disputedTransactionId}/status`, {
      method: "PATCH",
      body: { status: "DISPUTED", reason: "Production smoke dispute verification" }
    });
    invariant(record(record(disputeResult.value, "dispute response").transaction, "disputed transaction").status === "DISPUTED",
      "Buyer dispute did not move the reservation to DISPUTED");
    const adminDisputes = await adminClient.request("/api/admin/disputes");
    invariant(includesId(arrayField(adminDisputes.value, "disputes", "admin disputes"), disputedTransactionId),
      "Admin dispute queue does not contain the temporary dispute");
    const resolvedDispute = await adminClient.request(`/api/admin/disputes/${disputedTransactionId}/resolve`, {
      method: "PATCH",
      body: { verdict: "CANCELLED", reason: "Production smoke cancellation resolution" }
    });
    invariant(record(record(resolvedDispute.value, "resolved dispute response").transaction, "resolved dispute").status === "CANCELLED",
      "Admin dispute cancellation did not persist");

    step("Checking support, announcements, want ads, and notifications");
    const supportResult = await buyerClient.request("/api/support", {
      method: "POST",
      expected: 201,
      body: { subject: marker, description: `${marker} support request body`, category: "TECHNICAL" }
    });
    const ticketId = stringField(record(supportResult.value, "support response").ticket, "id", "support ticket");
    tracked.ticketIds.add(ticketId);
    await removeSharedTicketNotifications(ticketId, [...tracked.userIds]);
    const adminSupport = await adminClient.request(`/api/support/admin?q=${encodeURIComponent(runToken)}`);
    invariant(includesId(arrayField(adminSupport.value, "tickets", "admin support"), ticketId), "Admin cannot find the temporary support ticket");
    await adminClient.request(`/api/support/admin/${ticketId}`, {
      method: "PATCH",
      body: { status: "WAITING_FOR_USER", priority: "HIGH", reply: `${marker} admin reply` }
    });
    await buyerClient.request(`/api/support/${ticketId}/messages`, {
      method: "POST",
      expected: 201,
      body: { body: `${marker} user follow-up` }
    });
    const supportMessages = await buyerClient.request(`/api/support/${ticketId}/messages`);
    invariant(arrayField(supportMessages.value, "messages", "support messages").length >= 3, "Support conversation did not retain all messages");

    const announcementResult = await sellerClient.request("/api/announcements", {
      method: "POST",
      expected: 201,
      body: { title: marker, body: `${marker} approved campus announcement`, location: "INTI campus" }
    });
    const announcementId = stringField(record(announcementResult.value, "announcement response").announcement, "id", "announcement");
    tracked.announcementIds.add(announcementId);
    invariant(!includesId(arrayField((await anonymousClient.request("/api/announcements")).value, "announcements", "public announcements"), announcementId),
      "Pending announcement was visible publicly");
    await adminClient.request(`/api/admin/announcements/${announcementId}/status`, {
      method: "PATCH",
      body: { status: "ACTIVE" }
    });
    invariant(includesId(arrayField((await anonymousClient.request("/api/announcements")).value, "announcements", "public announcements"), announcementId),
      "Approved announcement was not visible publicly");
    await adminClient.request(`/api/admin/announcements/${announcementId}/status`, {
      method: "PATCH",
      body: { status: "EXPIRED" }
    });

    const wantAdResult = await buyerClient.request("/api/want-ads", {
      method: "POST",
      expected: 201,
      body: { title: marker, description: `${marker} wanted item description`, maxPrice: 55, categoryId }
    });
    const wantAdId = stringField(record(wantAdResult.value, "want ad response").wantAd, "id", "want ad");
    tracked.wantAdIds.add(wantAdId);
    const wantAds = await anonymousClient.request(`/api/want-ads?q=${encodeURIComponent(runToken)}`);
    invariant(includesId(arrayField(wantAds.value, "wantAds", "want ads"), wantAdId), "Public want-ad discovery failed");
    await buyerClient.request(`/api/want-ads/${wantAdId}/status`, { method: "PATCH", body: { status: "CLOSED" } });

    const sellerNotifications = await sellerClient.request("/api/community/notifications");
    invariant(arrayField(sellerNotifications.value, "notifications", "seller notifications").length > 0, "Seller did not receive workflow notifications");
    await sellerClient.request("/api/community/notifications/read", { method: "PATCH", expected: 204 });
    await buyerClient.request("/api/community/notifications/read", { method: "PATCH", expected: 204 });

    step("Checking admin controls, operational view, audit trail, and session invalidation");
    const overview = record((await adminClient.request("/api/admin/overview")).value, "admin overview");
    invariant(typeof overview.users === "number", "Admin overview is incomplete");
    const system = record((await adminClient.request("/api/admin/system")).value, "admin system");
    invariant(record(system.readiness, "admin system readiness").ready === true, "Admin system readiness is not healthy");
    const logs = await adminClient.request(`/api/admin/logs?limit=100&action=LISTING`);
    invariant(arrayField(logs.value, "logs", "admin logs").some((item) => record(item, "admin log").entityId === listingId),
      "Listing moderation audit trail is missing");
    await adminClient.request(`/api/admin/users/${buyer.id}/block`, {
      method: "PATCH",
      body: { isBlocked: true, reason: "Production smoke account-control check" }
    });
    await buyerClient.request("/api/auth/me", { expected: 401 });
    await buyerClient.request("/api/auth/login", {
      method: "POST",
      expected: 403,
      body: { email: buyer.email, password: buyer.password, rememberMe: false }
    });
    await adminClient.request(`/api/admin/users/${buyer.id}/block`, {
      method: "PATCH",
      body: { isBlocked: false }
    });
    await login(buyerClient, buyer, false);
    await adminClient.request("/api/auth/logout", { method: "POST", expected: 204 });
    await adminClient.request("/api/auth/me", { expected: 401 });

    step("All destructive production integration checks passed");
  } catch (error) {
    failure = error;
  } finally {
    try {
      await cleanupTemporaryData(cleanupIdentities, tracked, uploadsDir, ownerClients);
    } catch (cleanupError) {
      if (failure) {
        const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : "unknown cleanup failure";
        throw new AggregateError([failure, cleanupError], `Production smoke test failed and cleanup also failed: ${cleanupMessage}`);
      }
      throw cleanupError;
    }
  }
  if (failure) throw failure;
}

const abortController = new AbortController();
let interruptedBy: NodeJS.Signals | "OVERALL_DEADLINE" | undefined;
let heldRunLock: RunLock | undefined;
const tolerateClosedPipe = (error: NodeJS.ErrnoException) => {
  if (error.code !== "EPIPE") process.exitCode = 1;
};
process.stdout.on("error", tolerateClosedPipe);
process.stderr.on("error", tolerateClosedPipe);

const interrupt = (reason: NodeJS.Signals | "OVERALL_DEADLINE") => {
  interruptedBy ??= reason;
  if (!abortController.signal.aborted) abortController.abort(new Error(`Interrupted by ${reason}`));
};
const onSigint = () => interrupt("SIGINT");
const onSigterm = () => interrupt("SIGTERM");
const onSighup = () => interrupt("SIGHUP");
process.on("SIGINT", onSigint);
process.on("SIGTERM", onSigterm);
process.on("SIGHUP", onSighup);
const overallTimer = setTimeout(() => interrupt("OVERALL_DEADLINE"), OVERALL_TIMEOUT_MS);
overallTimer.unref();

try {
  const preconditions = validatePreconditions();
  heldRunLock = acquireRunLock(preconditions.lockFile, preconditions.expectedVersion);
  await runSmoke(abortController.signal, preconditions);
  step("PASS: production integration smoke completed with verified cleanup");
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown production smoke failure";
  if (!process.stderr.destroyed) process.stderr.write(`[production-smoke] FAIL: ${message}\n`);
  process.exitCode = 1;
} finally {
  clearTimeout(overallTimer);
  process.removeListener("SIGINT", onSigint);
  process.removeListener("SIGTERM", onSigterm);
  process.removeListener("SIGHUP", onSighup);
  releaseRunLock(heldRunLock);
  await prisma.$disconnect();
  if (interruptedBy && !process.stderr.destroyed) {
    process.stderr.write(`[production-smoke] Interrupted by ${interruptedBy} after cleanup was attempted\n`);
  }
}
