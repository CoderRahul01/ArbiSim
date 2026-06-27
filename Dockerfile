FROM ubuntu:22.04

# Avoid tzdata interactive prompt
ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js, Python, pip, curl, build-essential, and git
RUN apt-get update && \
    apt-get install -y curl python3 python3-pip python3-venv git build-essential && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Foundry (for Anvil)
RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="/root/.foundry/bin:${PATH}"
RUN foundryup

# Set working directory
WORKDIR /app

# Copy the entire project
COPY . .

# Build the Gateway (Node.js)
WORKDIR /app/gateway
RUN npm install
RUN npm run build

# Install Worker dependencies (Python)
WORKDIR /app/workers
RUN pip3 install --no-cache-dir -r requirements.txt

# Create a startup script to run both processes
# Express gateway uses Render's PORT env var; aiohttp worker uses PING_PORT (internal only)
WORKDIR /app
RUN printf '#!/bin/bash\nset -e\necho "Starting Express Gateway on port ${PORT:-3001}..."\ncd /app/gateway && npm start &\necho "Starting Python Background Worker..."\ncd /app/workers && PING_PORT=8081 python3 src/main.py\n' > /app/start.sh

RUN chmod +x /app/start.sh

# Render routes external traffic to PORT; Express gateway must listen on it
EXPOSE 10000

# Run both the gateway and the worker
CMD ["/app/start.sh"]
