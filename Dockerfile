FROM node:18
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip

RUN pip3 install --upgrade pip
RUN pip3 install tidal-dl

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
CMD [ "npm", "start" ]
