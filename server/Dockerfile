FROM node:20-slim

WORKDIR /app

# Install dependencies for mediasoup
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    libssl-dev \
    libsqlite3-0 \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Create directories
RUN mkdir -p /var/lib/lapcam /tmp/lapcam-server-buffer

EXPOSE 8080 10000-10100/udp 10000-10100/tcp

CMD ["node", "dist/index.js"]
