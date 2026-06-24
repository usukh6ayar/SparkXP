# --- Build stage: install all deps + compile TypeScript -> dist/ ---
FROM node:22-slim AS builder
WORKDIR /app

# Install deps first (better layer caching). Needs dev deps to run `nest build`.
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Run stage: production deps only + compiled output ---
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Only production dependencies in the final image.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Compiled app (includes dist/migrations/*.js, run on boot via DB_MIGRATIONS_RUN).
COPY --from=builder /app/dist ./dist

# Local-upload fallback dir (prod normally uses Cloudinary; harmless if unused).
RUN mkdir -p uploads

EXPOSE 3000
CMD ["node", "dist/main.js"]
