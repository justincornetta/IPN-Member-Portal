import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PR 70 is an isolated UX sandbox. Production/other PR builds stay unchanged.
  env: {
    IPN_GUEST_SANDBOX_ENABLED: process.env.CONTEXT === "deploy-preview" && process.env.REVIEW_ID === "70" && process.env.BRANCH === "feature/guest-event-rsvp" ? "1" : "0",
    IPN_GUEST_SANDBOX_ORIGIN: process.env.CONTEXT === "deploy-preview" && process.env.REVIEW_ID === "70" ? (process.env.DEPLOY_PRIME_URL || "https://deploy-preview-70--ipn-member-portal.netlify.app") : "",
  },
  turbopack: {
    root: process.cwd(),
  },
  logging: {
    serverFunctions: false,
  },
};

export default nextConfig;
