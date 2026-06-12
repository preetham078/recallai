FROM node:20-slim

# Create app directory
WORKDIR /app

# Install dependencies (skip dev and optional native modules for a smaller, more reliable build)
COPY package*.json ./
RUN npm ci --omit=dev --no-optional

# Bundle app source
COPY . .

# Cloud Run expects the app to listen on the port defined by the PORT env var
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
