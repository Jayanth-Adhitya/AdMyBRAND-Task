FROM node:20-slim AS build-frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm i --silent
COPY frontend ./
RUN npm run build

FROM node:20-slim
WORKDIR /app/gateway
ARG PUBLIC_BASE_URL
ENV PUBLIC_BASE_URL=$PUBLIC_BASE_URL
ENV NODE_ENV=production
COPY gateway/package.json gateway/package-lock.json* ./
RUN npm i --silent
COPY gateway/server.mjs ./
COPY --from=build-frontend /app/frontend/dist /app/frontend/dist
EXPOSE 3000
CMD ["node", "server.mjs"]
