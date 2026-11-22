import "server-only";
import { cache } from "react";
import { getTeacherClasses } from "@/lib/class-content";
import { getCurrentUser } from "@/lib/rbac";

// Share reads between the shell and the panel only within this server request.
export const getWorkspaceUser = cache(getCurrentUser);
export const getWorkspaceClasses = cache(getTeacherClasses);
