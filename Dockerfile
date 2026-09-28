# Build stage for React frontend
FROM node:20-slim AS builder
WORKDIR /app/frontend
# Railway injects service variables as Docker build args when declared here,
# so Vite can inline the backend URL at build time.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Production stage using serve
FROM node:20-slim
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/frontend/dist ./dist

EXPOSE 8000
CMD ["sh", "-c", "serve -s dist -l ${PORT:-8000}"]
