# The local Cloudflare runtime (wrangler pages dev + local D1). workerd needs glibc 2.35+, which
# the host (Ubuntu 20.04) lacks; Debian bookworm has 2.36. The repo, with its node_modules, is
# mounted at /app (compose.yaml), so wrangler is the version in package.json.
FROM node:22-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV HOME=/tmp/home WRANGLER_SEND_METRICS=false
WORKDIR /app
EXPOSE 8788
