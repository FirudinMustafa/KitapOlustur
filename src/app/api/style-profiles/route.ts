import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { styleProfiles } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const items = await db.query.styleProfiles.findMany({
    orderBy: [asc(styleProfiles.sortOrder)],
  });
  return NextResponse.json({ items });
}
