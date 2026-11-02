FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY src ./src
COPY scripts/serve.mjs ./scripts/serve.mjs
COPY dist ./dist
USER node
EXPOSE 8768
CMD ["node","scripts/serve.mjs"]
