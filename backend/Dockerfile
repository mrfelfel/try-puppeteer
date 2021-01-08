FROM node:buster

WORKDIR /app

COPY package.json package.json
RUN npm i

RUN apk update \
    && apk add openssl

COPY . .

EXPOSE 8081

CMD [ "npm", "start"]