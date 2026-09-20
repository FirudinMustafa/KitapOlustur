import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { projects, generationRuns, generatedBooks } from "@/db/schema";
import type { GeneratedUnit } from "@/lib/ai/schemas";
import { findMatches, type SearchResult } from "@/lib/search";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Giriş yapmanız gerekiyor" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const userProjects = await db.query.projects.findMany({ where: eq(projects.ownerId, userId) });
  if (!userProjects.length) {
    return NextResponse.json({ results: [] });
  }
  const projectIds = userProjects.map((p) => p.id);
  const projectNameById = new Map(userProjects.map((p) => [p.id, p.name]));

  const runs = await db.query.generationRuns.findMany({ where: inArray(generationRuns.projectId, projectIds) });
  const runIds = runs.map((r) => r.id);
  const projectIdByRunId = new Map(runs.map((r) => [r.id, r.projectId]));
  if (!runIds.length) {
    return NextResponse.json({ results: [] });
  }

  const books = await db.query.generatedBooks.findMany({ where: inArray(generatedBooks.runId, runIds) });

  const results: SearchResult[] = [];
  for (const book of books) {
    if (!Array.isArray(book.content)) continue;
    const projectId = projectIdByRunId.get(book.runId);
    if (!projectId) continue;
    const projectName = projectNameById.get(projectId) ?? "";
    results.push(...findMatches(projectId, projectName, book.bookType, book.content as GeneratedUnit[], query));
  }

  return NextResponse.json({ results: results.slice(0, 100) });
}
