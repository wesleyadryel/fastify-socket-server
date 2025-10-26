# syntax = docker/dockerfile:1

ARG NODE_VERSION=22.16.0

# Build stage
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Copy node_modules for plugins that need assets
RUN cp -r node_modules/@scalar ./dist/ || true

# Production stage
FROM node:${NODE_VERSION}-slim AS production
WORKDIR /app
ENV NODE_ENV=production

# Copy only package.json and package-lock.json for production dependencies
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev && npm cache clean --force

# Copy only the built application from build stage
COPY --from=build /app/dist ./dist

# Copy necessary assets for plugins
COPY --from=build /app/node_modules/@scalar ./node_modules/@scalar

LABEL name="fastify-socket-server"
LABEL version="1.0.0"
LABEL description="Fastify Socket Server with Redis support"

EXPOSE 3000
CMD ["node", "dist/index.js"]
