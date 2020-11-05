FROM openjdk:12-alpine
RUN apk add --no-cache git
RUN apk add --no-cache nodejs
RUN apk add --no-cache npm
