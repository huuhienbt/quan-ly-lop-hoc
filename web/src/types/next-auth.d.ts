import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      kind?: "student";
      studentAccountId?: string;
      studentSessionVersion?: number;
    } & DefaultSession["user"];
  }
  interface User {
    kind?: "student";
    studentAccountId?: string;
    studentSessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    studentAccountId?: string;
    studentSessionVersion?: number;
  }
}
