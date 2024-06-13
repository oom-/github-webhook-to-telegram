FROM node:20-alpine AS build
WORKDIR /opt/app
COPY *.js *.json /opt/app/
RUN npm ci
EXPOSE 80
CMD node main.js