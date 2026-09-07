# syntax=docker/dockerfile:1

###############################################################################
# Stage 1 - build the React production bundle
###############################################################################
FROM node:20-bookworm-slim AS frontend-build

WORKDIR /build/front-end

COPY front-end/package.json front-end/package-lock.json ./
RUN npm ci

COPY front-end/ ./

# No REACT_APP_API_BASE_URL -> the app talks to the same origin at /api.
ENV CI=true
RUN npm run build


###############################################################################
# Stage 2 - runtime image: Node + Express + Python ML runtime
###############################################################################
FROM node:20-bookworm-slim AS runtime

# Python runtime + toolchain for native npm modules (bcrypt).
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        python3-venv \
        python3-pip \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv "$VIRTUAL_ENV"
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /app/back-end

# --- Python deps (pinned) ---
COPY back-end/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# --- Node deps (production only) ---
COPY back-end/package.json back-end/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# --- Application source ---
COPY back-end/ ./

# --- React build served by Express (same origin) ---
COPY --from=frontend-build /build/front-end/build ./client

# Drop build toolchain to slim the final image.
RUN apt-get purge -y build-essential && apt-get autoremove -y

ENV NODE_ENV=production \
    PORT=9115 \
    PYTHON_BIN=/opt/venv/bin/python \
    CLIENT_BUILD_DIR=/app/back-end/client \
    RUNTIME_DIR=/tmp/toll-analysis-runtime

# The application source and dependency trees are read-only at runtime. Only
# generated inference files need ownership, avoiding a slow recursive chown of
# the complete Python/Node image on every source change.
RUN mkdir -p /tmp/toll-analysis-runtime && chown node:node /tmp/toll-analysis-runtime

USER node

EXPOSE 9115

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD curl -fsS http://localhost:9115/healthz || exit 1

CMD ["node", "server.js"]
