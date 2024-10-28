# syntax=docker/dockerfile:1
# Base image - installs dependencies
FROM node:20 AS base

# Declare wrapper directory (mainly intended for use by other scripts)
ENV WRAPPER_DIR=/ctm-bct
# Port used
ENV WRAPPER_PORT=3000

FROM base AS builder

WORKDIR ${WRAPPER_DIR}
COPY . .
RUN npm ci

# Runner stage
FROM base as runner
WORKDIR ${WRAPPER_DIR}
ENV NODE_ENV production

# Create a non-root user to run as
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY package.json package-lock.json ./
# Because this is a local copy, we can modify it. Remove the prepare script -
# otherwise NPM will attempt to run it, even in production mode, which appears
# to be a bug that will never be fixed
# (see https://github.com/npm/cli/issues/4027)
RUN npm pkg delete scripts.prepare
RUN npm ci
# For some reason this
# The local* thing is effectively a way of saying "if exists"
COPY ./.env ./.env.local* ./.env.production.local* ./start.js ./
COPY ./data/ ./data/
# Copy final code over from the builder
COPY --from=builder /${WRAPPER_DIR}/dist ./dist/

# Create a cache directory - Sqlite needs to be able to write to the cache dir
# for some reason
RUN mkdir ./ctgov-cache
RUN chown nodejs:nodejs ./ctgov-cache
ENV CTGOV_CACHE_FILE=${WRAPPER_DIR}/ctgov-cache/ctgov-cache.db

USER nodejs
EXPOSE ${WRAPPER_PORT}

CMD [ "node", "start.js" ]
