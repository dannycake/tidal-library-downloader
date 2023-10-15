FROM node:18
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip

# install tidal-dl
RUN pip3 install --upgrade pip
RUN pip3 install tidal-dl

# add tidal-dl to path
RUN find / -name "tidal-dl" -type f -executable -print -quit > tidal-dl_path.txt
RUN cat tidal-dl_path.txt >> /etc/profile
RUN rm tidal-dl_path.txt

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
CMD [ "npm", "start" ]
