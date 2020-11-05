FROM ubuntu:18.04 AS base
WORKDIR /bazells
COPY . .

# ENV: server
FROM openjdk:12-jdk-oracle AS server

# ENV: client_vscode
FROM node:15 AS client_vscode
WORKDIR /bazells/client_vscode
RUN npm install
