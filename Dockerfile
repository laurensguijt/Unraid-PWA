FROM node:22-alpine AS frontend-build
WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/tsconfig.json ./tsconfig.json
COPY frontend/vite.config.ts ./vite.config.ts
COPY frontend/index.html ./index.html
COPY frontend/public ./public
COPY frontend/src ./src
RUN npm run build

FROM node:22-alpine AS backend-build
WORKDIR /backend

COPY backend/package.json backend/package-lock.json* ./
RUN npm ci

COPY backend/tsconfig.json ./tsconfig.json
COPY backend/src ./src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=backend-build /backend/dist ./dist
COPY --from=frontend-build /frontend/dist ./public

RUN mkdir -p /app/data

EXPOSE 3001
CMD ["node", "dist/index.js"]
