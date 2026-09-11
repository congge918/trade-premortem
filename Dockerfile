FROM node:20-alpine
WORKDIR /app
COPY . .
ENV NODE_ENV=production
ENV PORT=4318
EXPOSE 4318
CMD ["node", "server.mjs"]
