# --- Build stage: install all deps + compile TypeScript -> dist/ ---
FROM node:22-slim AS builder
WORKDIR /app

# Install deps first (better layer caching). Needs dev deps to run `nest build`.
# Use `npm install` (not `npm ci`): a few transitive optional deps (@emnapi /
# @napi-rs wasm) resolve to different versions per-OS, so a lock generated on
# macOS fails `npm ci`'s strict sync check on this linux image. `npm install`
# reconciles the platform-correct tree at build time.
COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# --- Run stage: production deps only + compiled output ---
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Only production dependencies in the final image (see builder note on npm install).
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# Compiled app (includes dist/migrations/*.js, run on boot via DB_MIGRATIONS_RUN).
COPY --from=builder /app/dist ./dist

# Local-upload fallback dir (prod normally uses Cloudinary; harmless if unused).
RUN mkdir -p uploads

EXPOSE 3000
CMD ["node", "dist/main.js"]
