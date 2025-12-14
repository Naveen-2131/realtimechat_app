# Simple Node.js backend build
FROM node:18-alpine
WORKDIR /app

# Copy package files (allow optional lockfile)
COPY package.json package-lock.jso[n] ./

# Fix: Use npm install instead of npm ci if lockfile is missing
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 5000
CMD ["node", "server.js"]
