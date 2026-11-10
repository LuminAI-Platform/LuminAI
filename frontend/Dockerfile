# ---- Stage 1: Build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Accept build arguments from docker-compose
ARG VITE_API_URL
ARG VITE_AUTH_URL
ARG VITE_AUTH_CLIENT_ID

# Expose them to the Vite build engine
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_AUTH_URL=$VITE_AUTH_URL
ENV VITE_AUTH_CLIENT_ID=$VITE_AUTH_CLIENT_ID

RUN npm run build

# ---- Stage 2: Serve ----
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80