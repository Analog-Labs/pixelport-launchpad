FROM ghcr.io/openclaw/openclaw:2026.2.24

USER root

RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium \
  && mkdir -p /home/node/.openclaw/browser \
  && chown -R node:node /home/node/.openclaw \
  && rm -rf /var/lib/apt/lists/*

USER node
