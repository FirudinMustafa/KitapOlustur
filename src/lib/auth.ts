import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { projects } from "@/db/schema";

// Faz G3: every project-scoped API route calls this before reading or
// mutating anything. Returns the signed-in user's id on success, or a
// NextResponse the route should return as-is on failure - callers check
// `result instanceof NextResponse`. A project with ownerId === null is a
// pre-auth legacy row and is treated as inaccessible (owned by no one), not
// as public - the whole point of this check is that only the owner can act
// on a project. 404 (not 403) is returned for "exists but not yours" to
// avoid confirming a project id belongs to someone else.
export async function requireProjectOwner(projectId: string): Promise<string | NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Giriş yapmanız gerekiyor" }, { status: 401 });
  }

  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project || project.ownerId !== userId) {
    return NextResponse.json({ error: "Proje bulunamadı" }, { status: 404 });
  }

  return userId;
}
