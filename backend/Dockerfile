FROM node:buster

WORKDIR /app

COPY package.json package.json
RUN npm i

COPY . .

EXPOSE 8081

CMD [ "npm", "start"]