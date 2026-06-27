FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# 1. System deps
RUN apt-get update && \
    apt-get install -y curl python3 python3-pip python3-venv git build-essential && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 2. Foundry — installed before any COPY so this layer is cached across code changes
RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="/root/.foundry/bin:${PATH}"
RUN foundryup

# 3. Node deps — cached until gateway/package.json changes
WORKDIR /app/gateway
COPY gateway/package*.json ./
RUN npm install

# 4. Python deps — cached until workers/requirements.txt changes
WORKDIR /app/workers
COPY workers/requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt

# 5. Copy full source (only this layer re-runs on code changes)
WORKDIR /app
COPY . .

# 6. Build gateway TypeScript
WORKDIR /app/gateway
RUN npm run build

# 7. Startup: Express uses Render's PORT; aiohttp worker uses PING_PORT (internal only)
WORKDIR /app
RUN printf '#!/bin/bash\nset -e\ncd /app/gateway && npm start &\ncd /app/workers && python3 src/main.py\n' > /app/start.sh \
    && chmod +x /app/start.sh

EXPOSE 10000

CMD ["/app/start.sh"]
