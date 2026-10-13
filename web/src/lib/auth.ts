import "server-only";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { batch, execute, query } from "@/lib/d1";
import { getSuperAdminEmails } from "@/lib/config";

interface IdentityUser {
  id: string;
  email: string;
  role: "PENDING" | "TEACHER" | "SUPER_ADMIN";
  status: "ACTIVE" | "SUSPENDED";
}

interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
  image: string | null;
}

async function accountUser(sub: string): Promise<IdentityUser | undefined> {
  return (await query<IdentityUser>(
    `SELECT u.id, u.email, u.role, u.status FROM accounts a
     JOIN users u ON u.id = a.user_id
     WHERE a.provider = 'google' AND a.provider_account_id = ?`, [sub],
  ))[0];
}

// Google sub is the identity key. Never attach a new sub to an existing email.
async function syncGoogleIdentity(identity: GoogleIdentity): Promise<IdentityUser | "collision" | "suspended"> {
  let existing = await accountUser(identity.sub);
  const emailOwner = (await query<{ id: string }>("SELECT id FROM users WHERE email = ?", [identity.email]))[0];
  if (emailOwner && emailOwner.id !== existing?.id) return "collision";
  if (existing?.status === "SUSPENDED") return "suspended";
  const now = new Date().toISOString();

  if (!existing) {
    const id = crypto.randomUUID();
    const role = getSuperAdminEmails().has(identity.email) ? "SUPER_ADMIN" : "PENDING";
    await batch([
      {
        sql: `INSERT INTO users (id, email, name, image_url, email_verified_at, role, last_login_at)
              SELECT ?, ?, ?, ?, ?, ?, ?
              WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE provider = 'google' AND provider_account_id = ?)
                AND NOT EXISTS (SELECT 1 FROM users WHERE email = ?)`,
        params: [id, identity.email, identity.name, identity.image, now, role, now, identity.sub, identity.email],
      },
      {
        sql: `INSERT INTO accounts (provider, provider_account_id, user_id)
              SELECT 'google', ?, id FROM users WHERE id = ?
              ON CONFLICT (provider, provider_account_id) DO NOTHING`,
        params: [identity.sub, id],
      },
      {
        sql: `INSERT INTO teacher_requests (id, user_id, school_id)
              SELECT ?, u.id, s.id FROM users u CROSS JOIN schools s
              WHERE u.id = ? AND u.role = 'PENDING' AND s.id = 'school-ben-tre' AND s.archived_at IS NULL
              ON CONFLICT (user_id, school_id) DO NOTHING`,
        params: [crypto.randomUUID(), id],
      },
    ]);
    existing = await accountUser(identity.sub);
    // Concurrent callbacks may have created the same account first. Resolve by sub only.
    if (!existing) return "collision";
    if (existing.status === "SUSPENDED") return "suspended";
  }

  await execute(
    `UPDATE users SET email = ?, name = ?, image_url = ?, email_verified_at = ?,
      last_login_at = ?, updated_at = ?
     WHERE id = ? AND status = 'ACTIVE'
       AND NOT EXISTS (SELECT 1 FROM users WHERE email = ? AND id <> ?)`,
    [identity.email, identity.name, identity.image, now, now, now, existing.id, identity.email, existing.id],
  );
  // Re-check after writes so a simultaneous suspension cannot issue a new usable session.
  const current = await accountUser(identity.sub);
  if (!current || current.status !== "ACTIVE") return "suspended";
  if (current.email.toLowerCase() !== identity.email) return "collision";
  return current;
}

export const authOptions: NextAuthOptions = {
  providers: [GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    authorization: { params: { scope: "openid email profile", prompt: "select_account" } },
    checks: ["pkce", "state", "nonce"],
    allowDangerousEmailAccountLinking: false,
  })],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/", error: "/" },
  debug: false,
  logger: {
    error(code) { console.error("[auth]", code); },
    warn(code) { console.warn("[auth]", code); },
    debug() {},
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google" || !profile ||
        !("email_verified" in profile) || profile.email_verified !== true ||
        !("sub" in profile) || typeof profile.sub !== "string" || !profile.sub ||
        profile.sub !== account.providerAccountId || typeof profile.email !== "string" ||
        !profile.email.trim()) return false;
      const email = profile.email.trim().toLowerCase();
      try {
        const result = await syncGoogleIdentity({
          sub: profile.sub,
          email,
          name: user.name?.trim() || email.split("@")[0],
          image: user.image ?? null,
        });
        if (result === "collision") return "/?error=OAuthAccountNotLinked";
        if (result === "suspended") return "/?error=AccessDenied";
        user.id = result.id;
        return true;
      } catch {
        return "/?error=AuthenticationUnavailable";
      }
    },
    async jwt({ token, user }) {
      // No role/status/email claim is used as authorization. D1 owns current permissions.
      if (user) return { userId: user.id };
      return token;
    },
    async session({ session, token }) {
      return { ...session, user: { id: typeof token.userId === "string" ? token.userId : "" } };
    },
  },
};
