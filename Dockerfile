FROM node:22-bookworm-slim
WORKDIR /app
COPY --chown=node:node app ./app
COPY --chown=node:node package.json ./
RUN mkdir /app/data && chown node:node /app/data
USER node
ENV HOST=0.0.0.0 PORT=3000 DB_PATH=/app/data/ecosystem.sqlite
EXPOSE 3000
CMD ["node","app/server.mjs"]
