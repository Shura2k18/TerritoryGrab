FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/
COPY packages/shared/package.json ./packages/shared/
RUN npm install

COPY . .

RUN npm run build -w packages/shared

RUN npm run build -w packages/client

RUN npm run build -w packages/server

ENV PORT=8000
EXPOSE 8000

CMD ["node", "packages/server/dist/main"]