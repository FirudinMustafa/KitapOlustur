import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { niceToHaveItems } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const items = await db.query.niceToHaveItems.findMany({
    orderBy: [asc(niceToHaveItems.sortOrder)],
  });
  return NextResponse.json({ items });
}
