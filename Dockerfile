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

WORKDIR /app/back-end

# Install build-only tooling, create the Python runtime, install both runtime
# dependency sets, then remove build tooling in the same image layer. The
# final image retains Python, curl (for /livez) and native libraries only.
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
COPY back-end/requirements.txt back-end/package.json back-end/package-lock.json ./
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-venv build-essential curl \
    && python3 -m venv "$VIRTUAL_ENV" \
    && pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && npm ci --omit=dev \
    && npm cache clean --force \
    && rm -rf /root/.cache /tmp/* \
    && apt-get purge -y --auto-remove build-essential python3-venv \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf "$VIRTUAL_ENV"/lib/python*/site-packages/pip* "$VIRTUAL_ENV"/bin/pip*

# --- Application source ---
COPY back-end/ ./
# The explicit managed-DB bootstrap reads the same reviewed SQL sources as the
# local MySQL image; it is never run automatically at application startup.
COPY db/init /app/db/init

# --- React build served by Express (same origin) ---
COPY --from=frontend-build /build/front-end/build ./client

ENV NODE_ENV=production \
    PORT=9115 \
    PYTHON_BIN=/opt/venv/bin/python \
    CLIENT_BUILD_DIR=/app/back-end/client \
    RUNTIME_DIR=/tmp/toll-analysis-runtime \
    DATABASE_CONNECTION_LIMIT=3 \
    DATABASE_CONNECT_TIMEOUT_MS=10000 \
    INFERENCE_MAX_CONCURRENT=1 \
    OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    NUMEXPR_NUM_THREADS=1

# The application source and dependency trees are read-only at runtime. Only
# generated inference files need ownership, avoiding a slow recursive chown of
# the complete Python/Node image on every source change.
RUN mkdir -p /tmp/toll-analysis-runtime && chown node:node /tmp/toll-analysis-runtime

USER node

EXPOSE 9115

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD curl -fsS http://localhost:9115/livez || exit 1

CMD ["node", "server.js"]
