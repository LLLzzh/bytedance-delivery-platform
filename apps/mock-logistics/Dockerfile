# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.6

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/mock-logistics ./apps/mock-logistics

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the application
WORKDIR /app/apps/mock-logistics
RUN pnpm build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.6

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/mock-logistics/package.json ./apps/mock-logistics/
COPY apps/mock-logistics/dist ./apps/mock-logistics/dist

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod --recursive

WORKDIR /app/apps/mock-logistics

CMD ["node", "dist/index.js"]

