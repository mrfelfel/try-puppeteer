FROM node:buster

WORKDIR /app

COPY package.json package.json
RUN npm i

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    ca-certificates \
    openssl \
    && mkdir -p /usr/local/share/ca-certificates

ADD https://letsencrypt.org/certs/isrgrootx1.pem.txt /usr/local/share/ca-certificates/isrgrootx1.pem
ADD https://letsencrypt.org/certs/trustid-x3-root.pem.txt /usr/local/share/ca-certificates/trustid-x3-root.pem

RUN cd /usr/local/share/ca-certificates \
    && openssl x509 -in isrgrootx1.pem -inform PEM -out isrgrootx1.crt \
    && openssl x509 -in trustid-x3-root.pem -inform PEM -out trustid-x3-root.crt \
    && update-ca-certificates

COPY . .

EXPOSE 8081

CMD [ "npm", "start"]