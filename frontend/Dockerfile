FROM node:22-alpine

WORKDIR /app
ARG ENABLE_BACKEND_REWRITES=true
ENV ENABLE_BACKEND_REWRITES=$ENABLE_BACKEND_REWRITES
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
