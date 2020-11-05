FROM openjdk:12-alpine as dev
RUN apk update
RUN apk add --no-cache openssh
RUN apk add --no-cache git
RUN apk add --no-cache nodejs
RUN apk add --no-cache npm
