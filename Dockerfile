FROM node:20-alpine

WORKDIR /app

# Install main app dependencies
COPY package*.json ./
RUN npm install

# Install UI dependencies
COPY ui/package*.json ./ui/
RUN cd ui && npm install

# Copy source code
COPY . .

# Expose common ports (UI, API, Tracker, Worker HTTP ranges)
EXPOSE 3000 3001 4000 6881 5001-5020 8080-8100

# Default command (overridden by docker-compose)
CMD ["node", "src/orchestrator.js"]
