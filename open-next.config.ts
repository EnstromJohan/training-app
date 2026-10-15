import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// No ISR in this app: prerendered pages are served straight from the static assets.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
