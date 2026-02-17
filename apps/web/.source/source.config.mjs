// source.config.ts
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
var docs = defineDocs({
  // Points to the root-level docs/ directory in the monorepo
  dir: "../../docs"
});
var source_config_default = defineConfig();
export {
  source_config_default as default,
  docs
};
