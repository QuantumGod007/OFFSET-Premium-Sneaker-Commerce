FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && mkdir data && chown node:node data
COPY --chown=node:node server ./server
COPY --chown=node:node public ./public
ENV NODE_ENV=production PORT=3001 DATA_PATH=/app/data/store.json
USER node
VOLUME ["/app/data"]
EXPOSE 3001
CMD ["npm", "start"]
