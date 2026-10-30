FROM node:22-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev
COPY backend ./backend
COPY db ./db
WORKDIR /app/backend
ENV NODE_ENV=production
USER node
EXPOSE 4000
CMD ["node", "src/server.js"]
