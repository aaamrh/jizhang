FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
# 不用 npm ci：lock 文件在 Windows 上生成，缺少 Linux 平台的可选依赖，npm ci 会报错
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/admin ./admin
COPY --from=build /app/legal ./legal
# 照片存储目录（STORAGE_DRIVER=local 时用；docker-compose 里挂卷）
RUN mkdir -p /data/files && chown node:node /data/files
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
