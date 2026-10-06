import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

// Faz C2 ("kullanıcının kendi görselini ekleyebilmesi", 2026-09-28) - same
// pattern as src/app/api/blob/upload-logo/route.ts (own sibling route rather
// than widening the PDF-only src/app/api/blob/upload/route.ts), lets a user
// upload their own image for a specific book page from the Dizilim editor's
// "Konumlandır" panel, instead of only ever seeing AI-generated page images.
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Giriş yapmanız gerekiyor" }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        // No WebP: @react-pdf/image (PDF export) only decodes PNG/JPEG/SVG, so a
        // WebP page image broke the next book assembly (QA fix, 2026-10-06).
        allowedContentTypes: ["image/png", "image/jpeg"],
        maximumSizeInBytes: 15 * 1024 * 1024,
        addRandomSuffix: true,
      }),
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
