# DorkOS CLI Smoke Test
# Usage:
#   pnpm --filter=dorkos run build
#   cd packages/cli && pnpm pack --pack-destination ../../ && cd ../..
#   docker build -t dorkos-smoke .
#   docker run --rm dorkos-smoke

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-slim

# Install build tools for native addons (better-sqlite3)
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 build-essential libsqlite3-dev && \
    rm -rf /var/lib/apt/lists/*

# Mock Claude CLI so --post-install-check succeeds without a real install
ARG MOCK_CLAUDE=true
RUN if [ "$MOCK_CLAUDE" = "true" ]; then \
      printf '#!/bin/sh\necho "claude mock 1.0.0"\n' > /usr/local/bin/claude && \
      chmod +x /usr/local/bin/claude; \
    fi

# Copy the pre-built tarball (must exist in build context)
COPY dorkos-*.tgz /tmp/dorkos.tgz

# Install globally from tarball
RUN npm install -g /tmp/dorkos.tgz && rm /tmp/dorkos.tgz

# Smoke tests
CMD set -e && \
    echo "=== which dorkos ===" && which dorkos && \
    echo "=== dorkos --version ===" && dorkos --version && \
    echo "=== dorkos --help ===" && dorkos --help && \
    echo "=== dorkos --post-install-check ===" && dorkos --post-install-check && \
    echo "=== dorkos init --yes ===" && dorkos init --yes && \
    echo "" && echo "All smoke tests passed."
