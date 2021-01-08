FROM node:15.5.1-alpine3.10

WORKDIR /app

COPY package.json package.json
RUN npm i

COPY . .

EXPOSE 8081

CMD [ "npm", "start"]