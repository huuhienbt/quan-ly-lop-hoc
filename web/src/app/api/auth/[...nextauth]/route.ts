import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { getSetupState } from "@/lib/config";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ nextauth: string[] }> };

async function handler(request: NextRequest, context: RouteContext) {
  const setup = getSetupState();
  const { nextauth } = await context.params;
  const existingSessionAction = ["session", "csrf", "signout"].includes(nextauth[0]);
  if (existingSessionAction ? !setup.sessionReady : !setup.ready) {
    return Response.json({
      error: "ConfigurationUnavailable",
      message: "Đăng nhập Google chưa được cấu hình đầy đủ. Vui lòng liên hệ quản trị viên.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return NextAuth(request, context, authOptions);
}

export { handler as GET, handler as POST };
