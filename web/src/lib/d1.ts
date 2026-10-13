import "server-only";
import { getDatabaseConfig } from "@/lib/config";

export type SqlValue = string | number | null;
export interface D1Statement { sql: string; params?: SqlValue[] }
export interface D1Result<T = Record<string, unknown>> {
  success: boolean;
  results: T[];
  meta: { changes: number; [key: string]: unknown };
}

// Keep database errors out of OAuth URLs, browser responses and credential logs.
export class D1Error extends Error {
  constructor(public readonly kind: "network" | "response" | "query", public readonly status?: number) {
    super("Không thể hoàn thành thao tác cơ sở dữ liệu.");
    this.name = "D1Error";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function request<T>(body: D1Statement | D1Statement[]): Promise<D1Result<T>[]> {
  const { url, token } = getDatabaseConfig();
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    // Do not automatically replay uncertain writes after a connection timeout.
    throw new D1Error("network");
  }
  if (!response.ok) throw new D1Error("response", response.status);
  let envelope: unknown;
  try { envelope = await response.json(); } catch { throw new D1Error("response"); }
  if (!isRecord(envelope) || envelope.success !== true || !Array.isArray(envelope.result)) {
    throw new D1Error("query");
  }
  const expected = Array.isArray(body) ? body.length : 1;
  if (envelope.result.length !== expected) throw new D1Error("response");
  return envelope.result.map((value: unknown) => {
    if (!isRecord(value) || value.success !== true || !Array.isArray(value.results) ||
      !isRecord(value.meta) || typeof value.meta.changes !== "number") {
      throw new D1Error("query");
    }
    return value as unknown as D1Result<T>;
  });
}

export async function query<T = Record<string, unknown>>(sql: string, params: SqlValue[] = []): Promise<T[]> {
  return (await request<T>({ sql, params }))[0].results;
}

export async function execute(sql: string, params: SqlValue[] = []): Promise<D1Result> {
  return (await request<Record<string, unknown>>({ sql, params }))[0];
}

export async function batch(statements: D1Statement[]): Promise<D1Result[]> {
  if (statements.length === 0) return [];
  // The authenticated Worker executes this array using D1's atomic DB.batch().
  // One request only. Never fall back to sequential writes when a batch fails.
  return request<Record<string, unknown>>(statements.map(({ sql, params }) => ({ sql, params: params ?? [] })));
}
