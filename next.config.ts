import path from "node:path";
import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

// Local dev only: keep the local workflow world's state (runs, steps and
// the hooks that approval gates wait on) OUTSIDE .next/. withWorkflow puts
// it in .next/workflow-data, and `next build` recreates .next/ - which once
// wiped the waiting approval of every in-flight dev run, leaving them stuck.
// Setting the target world first makes withWorkflow leave the path alone.
if (!process.env.VERCEL_DEPLOYMENT_ID && !process.env.WORKFLOW_TARGET_WORLD) {
  process.env.WORKFLOW_TARGET_WORLD = "local";
  process.env.WORKFLOW_LOCAL_DATA_DIR ??= path.join(__dirname, ".workflow-data");
}

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
};

export default withWorkflow(nextConfig);
