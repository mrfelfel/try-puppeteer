FROM node:buster

WORKDIR /app

COPY package.json package.json
RUN npm i
RUN apt-get install ca-certificates

COPY . .

EXPOSE 8081

CMD [ "npm", "start"]