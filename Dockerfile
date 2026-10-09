# ---------- 1. build do frontend (Angular) ----------
FROM node:22-bookworm-slim AS frontend
WORKDIR /fe
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- 2. build do backend (TypeScript) ----------
FROM node:22-bookworm-slim AS backend
WORKDIR /be
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build && npm prune --omit=dev

# ---------- 3. runtime ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=7125
ENV STATIC_DIR=/app/public
COPY --from=backend /be/node_modules ./node_modules
COPY --from=backend /be/dist ./dist
COPY --from=backend /be/package.json ./package.json
COPY --from=frontend /fe/dist/frontend/browser ./public
EXPOSE 7125
CMD ["node", "--experimental-sqlite", "--disable-warning=ExperimentalWarning", "dist/index.js"]
