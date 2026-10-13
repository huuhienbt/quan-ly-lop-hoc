import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { authOptions } from "../src/lib/auth.ts";
import { createD1Fixture, insertUser } from "./d1-fixture.mjs";

let fixture;
beforeEach(() => { fixture = createD1Fixture(); });
afterEach(() => { fixture.restore(); });

function googleSignIn(overrides = {}) {
  const profile = {
    sub: "google-sub-1",
    email: "Teacher@Example.com",
    email_verified: true,
    ...overrides.profile,
  };
  const user = { id: "provider-user-id", name: "Cô giáo", image: null, ...overrides.user };
  const account = {
    provider: "google",
    providerAccountId: profile.sub,
    type: "oauth",
    access_token: "google-access-token-must-not-be-persisted",
    refresh_token: "google-refresh-token-must-not-be-persisted",
    ...overrides.account,
  };
  return { user, account, profile };
}

test("Google verification must be the boolean true before any database access", async () => {
  for (const email_verified of [false, undefined, "true", 1]) {
    assert.equal(await authOptions.callbacks.signIn(googleSignIn({ profile: { email_verified } })), false);
  }
  assert.equal(fixture.requests.length, 0);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM users").get().n, 0);
});

test("untrusted providers, mismatched Google sub and blank identities are rejected", async () => {
  const attempts = [
    googleSignIn({ account: { provider: "credentials" } }),
    googleSignIn({ account: { providerAccountId: "different-google-sub" } }),
    googleSignIn({ profile: { sub: "" } }),
    googleSignIn({ profile: { email: "  " } }),
  ];
  for (const attempt of attempts) assert.equal(await authOptions.callbacks.signIn(attempt), false);
  assert.equal(fixture.requests.length, 0);
});

test("a verified first login creates a pending user, linked Google identity and review request", async () => {
  const attempt = googleSignIn();
  assert.equal(await authOptions.callbacks.signIn(attempt), true);
  const user = fixture.database.prepare("SELECT * FROM users WHERE id = ?").get(attempt.user.id);
  assert.equal(user.email, "teacher@example.com");
  assert.equal(user.role, "PENDING");
  assert.equal(user.status, "ACTIVE");
  assert.ok(user.email_verified_at);
  const account = fixture.database.prepare("SELECT * FROM accounts").get();
  assert.equal(account.provider_account_id, "google-sub-1");
  assert.equal(account.user_id, user.id);
  const request = fixture.database.prepare("SELECT * FROM teacher_requests").get();
  assert.equal(request.status, "PENDING");
  assert.equal(request.school_id, "school-ben-tre");
  assert.equal(request.user_id, user.id);
  const persistedParameters = JSON.stringify(fixture.requests);
  assert.equal(persistedParameters.includes("google-access-token-must-not-be-persisted"), false);
  assert.equal(persistedParameters.includes("google-refresh-token-must-not-be-persisted"), false);
});

test("only a verified allowlisted first login bootstraps a super administrator", async () => {
  process.env.SUPER_ADMIN_EMAILS = "  ADMIN@example.com, other@example.com ";
  const attempt = googleSignIn({ profile: { email: "Admin@Example.com" } });
  assert.equal(await authOptions.callbacks.signIn(attempt), true);
  assert.equal(fixture.database.prepare("SELECT role FROM users WHERE id = ?").get(attempt.user.id).role, "SUPER_ADMIN");
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM teacher_requests").get().n, 0);
});

test("adding an existing pending user to the bootstrap allowlist never silently promotes them", async () => {
  const first = googleSignIn();
  assert.equal(await authOptions.callbacks.signIn(first), true);
  process.env.SUPER_ADMIN_EMAILS = "teacher@example.com";
  const second = googleSignIn();
  assert.equal(await authOptions.callbacks.signIn(second), true);
  assert.equal(second.user.id, first.user.id);
  assert.equal(fixture.database.prepare("SELECT role FROM users WHERE id = ?").get(first.user.id).role, "PENDING");
});

test("repeated login updates the same sub without duplicate users or review requests", async () => {
  const first = googleSignIn();
  assert.equal(await authOptions.callbacks.signIn(first), true);
  const second = googleSignIn({ user: { name: "Tên được cập nhật" } });
  assert.equal(await authOptions.callbacks.signIn(second), true);
  assert.equal(second.user.id, first.user.id);
  assert.equal(fixture.database.prepare("SELECT name FROM users WHERE id = ?").get(first.user.id).name, "Tên được cập nhật");
  for (const table of ["users", "accounts", "teacher_requests"]) {
    assert.equal(fixture.database.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 1);
  }
});

test("a new Google sub cannot take over an existing email even when Google verifies it", async () => {
  const first = googleSignIn();
  assert.equal(await authOptions.callbacks.signIn(first), true);
  const second = googleSignIn({ profile: { sub: "attacker-google-sub" } });
  assert.equal(await authOptions.callbacks.signIn(second), "/?error=OAuthAccountNotLinked");
  assert.equal(second.user.id, "provider-user-id");
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM users").get().n, 1);
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM accounts").get().n, 1);
});

test("an existing Google sub can update its unused email but cannot take another user's email", async () => {
  const first = googleSignIn();
  assert.equal(await authOptions.callbacks.signIn(first), true);
  const changed = googleSignIn({ profile: { email: "changed@example.com" } });
  assert.equal(await authOptions.callbacks.signIn(changed), true);
  assert.equal(changed.user.id, first.user.id);
  insertUser(fixture.database, { email: "occupied@example.com" });
  const collision = googleSignIn({ profile: { email: "occupied@example.com" } });
  assert.equal(await authOptions.callbacks.signIn(collision), "/?error=OAuthAccountNotLinked");
  assert.equal(fixture.database.prepare("SELECT email FROM users WHERE id = ?").get(first.user.id).email, "changed@example.com");
});

test("suspended users cannot sign in and are not reactivated by the bootstrap allowlist", async () => {
  const first = googleSignIn();
  assert.equal(await authOptions.callbacks.signIn(first), true);
  fixture.database.prepare("UPDATE users SET status = 'SUSPENDED' WHERE id = ?").run(first.user.id);
  process.env.SUPER_ADMIN_EMAILS = "teacher@example.com";
  assert.equal(await authOptions.callbacks.signIn(googleSignIn()), "/?error=AccessDenied");
  const user = fixture.database.prepare("SELECT role, status FROM users WHERE id = ?").get(first.user.id);
  assert.equal(user.status, "SUSPENDED");
  assert.equal(user.role, "PENDING");
});

test("JWT and session callbacks retain only application identity rather than role or OAuth tokens", async () => {
  const token = await authOptions.callbacks.jwt({
    token: { role: "SUPER_ADMIN", accessToken: "must-not-survive", email: "old@example.com" },
    user: { id: "database-user-id", role: "SUPER_ADMIN" },
  });
  assert.deepEqual(token, { userId: "database-user-id" });
  const session = await authOptions.callbacks.session({
    session: { expires: "2030-01-01T00:00:00Z", user: { name: "Stale user", role: "SUPER_ADMIN" } },
    token: { userId: "database-user-id", role: "SUPER_ADMIN" },
  });
  assert.deepEqual(session.user, { id: "database-user-id" });
});

test("an unavailable database produces a generic authentication failure without linking an account", async () => {
  globalThis.fetch = async () => { throw new Error("upstream SQL and secret should not reach the client"); };
  const attempt = googleSignIn();
  assert.equal(await authOptions.callbacks.signIn(attempt), "/?error=AuthenticationUnavailable");
  assert.equal(attempt.user.id, "provider-user-id");
  assert.equal(fixture.database.prepare("SELECT count(*) AS n FROM users").get().n, 0);
});
