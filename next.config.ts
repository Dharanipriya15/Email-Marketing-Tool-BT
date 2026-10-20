import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent `next dev` from auto-appending Next.js's own agent-rules block
  // into claude.md (Windows filesystems are case-insensitive, so it would
  // otherwise land in the project's actual instructions file).
  agentRules: false,
};

export default nextConfig;
