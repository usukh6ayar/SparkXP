# EnglishXP API — multi-stage build.
# debian-slim (not alpine) because `sharp` ships glibc prebuilt binaries.

# ---- build stage: compile TS -> dist ----
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime stage: prod deps only ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Local-fallback upload dir (used only when Cloudinary env is unset).
RUN mkdir -p uploads
EXPOSE 3000
CMD ["node", "dist/main"]
