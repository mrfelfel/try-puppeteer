FROM node:latest

WORKDIR /app

COPY package.json package.json
RUN npm i

COPY . .

EXPOSE 2006

CMD [ "npm", "start"]