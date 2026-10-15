import "server-only";

export class ConfigurationError extends Error {
  constructor(public readonly missing: string[]) {
    super("Cấu hình máy chủ chưa đầy đủ hoặc chưa hợp lệ.");
    this.name = "ConfigurationError";
  }
}

const present = (key: string) => Boolean(process.env[key]?.trim());

function validAuthUrl() {
  try {
    const url = new URL(process.env.NEXTAUTH_URL ?? "");
    return !url.username && !url.password && (
      url.protocol === "https:" || (
        process.env.NODE_ENV !== "production" && url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      )
    );
  } catch {
    return false;
  }
}

function localDatabaseMissing(): string[] {
  const missing: string[] = [];
  try {
    const url = new URL(process.env.D1_LOCAL_API_URL ?? "");
    if (process.env.NODE_ENV === "production" || url.protocol !== "http:" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash || url.pathname !== "/query") {
      missing.push("D1_LOCAL_API_URL");
    }
  } catch {
    missing.push("D1_LOCAL_API_URL");
  }
  if ((process.env.D1_LOCAL_API_TOKEN?.trim().length ?? 0) < 32) missing.push("D1_LOCAL_API_TOKEN");
  return missing;
}

function remoteDatabaseMissing(): string[] {
  const missing: string[] = [];
  try {
    const url = new URL(process.env.D1_GATEWAY_URL ?? "");
    if (url.protocol !== "https:" || url.pathname !== "/query" || url.username || url.password ||
      url.search || url.hash || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
      missing.push("D1_GATEWAY_URL");
    }
  } catch {
    missing.push("D1_GATEWAY_URL");
  }
  if ((process.env.D1_GATEWAY_TOKEN?.trim().length ?? 0) < 32) missing.push("D1_GATEWAY_TOKEN");
  return missing;
}

export function getSetupState() {
  const authMissing = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"].filter((key) => !present(key));
  if ((process.env.NEXTAUTH_SECRET?.length ?? 0) < 32) authMissing.push("NEXTAUTH_SECRET");
  if (!validAuthUrl()) authMissing.push("NEXTAUTH_URL");
  const databaseMissing = present("D1_LOCAL_API_URL") ? localDatabaseMissing() : remoteDatabaseMissing();
  const databaseReady = databaseMissing.length === 0;
  const authReady = authMissing.length === 0;
  return {
    authReady,
    databaseReady,
    ready: authReady && databaseReady,
    sessionReady: databaseReady && (process.env.NEXTAUTH_SECRET?.length ?? 0) >= 32,
    studentAuthReady: databaseReady && (process.env.NEXTAUTH_SECRET?.length ?? 0) >= 32 && validAuthUrl(),
    adminBootstrapReady: getSuperAdminEmails().size > 0,
    missing: [...authMissing, ...databaseMissing],
  };
}

export function getSuperAdminEmails(): Set<string> {
  return new Set((process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

export function getDatabaseConfig(): { url: string; token: string } {
  const local = present("D1_LOCAL_API_URL");
  const missing = local ? localDatabaseMissing() : remoteDatabaseMissing();
  if (missing.length) throw new ConfigurationError(missing);
  if (local) {
    return { url: process.env.D1_LOCAL_API_URL!.trim(), token: process.env.D1_LOCAL_API_TOKEN!.trim() };
  }
  return {
    url: process.env.D1_GATEWAY_URL!.trim(),
    token: process.env.D1_GATEWAY_TOKEN!.trim(),
  };
}
