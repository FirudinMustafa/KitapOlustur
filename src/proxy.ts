import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Faz G3: everything in the app requires sign-in except the sign-in/up pages
// themselves and the Workflow platform's own callback endpoints under
// /.well-known/workflow - those are invoked directly by Vercel's Workflow
// runtime (step callbacks, hook webhooks), not by a browser carrying a
// Clerk session, and must stay reachable or the whole pipeline breaks.
//
// Named/placed as proxy.ts, not middleware.ts: Next.js 16 deprecated and
// renamed the middleware file convention to "proxy" (see
// node_modules/next/dist/docs/.../file-conventions/proxy.md). Clerk's own
// `clerkMiddleware` export name is unaffected by that rename - only the
// Next.js file convention changed.
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/.well-known/workflow(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
