FROM node:buster

WORKDIR /app

COPY package.json package.json
RUN npm i

RUN apt-get -yqq install build-essential libssl-dev libffi-dev python3-pip python3-dev gnupg


COPY . .

EXPOSE 8081

CMD [ "npm", "start"]