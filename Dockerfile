FROM debian:stretch-slim
ENV NODE_VERSION=12.16.0
ENV NPM="/root/.nvm/versions/node/v${NODE_VERSION}/bin/npm"
ENV NODE="/root/.nvm/versions/node/v${NODE_VERSION}/bin/node"
RUN apt-get update && \
    apt-get install ca-certificates curl gconf-service git libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release rsync xdg-utils wget -y
RUN wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.33.2/install.sh | bash
ENV NVM_DIR=/root/.nvm
RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" &&  nvm use v${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm alias default v${NODE_VERSION}
RUN cp ${NODE} /usr/bin/
RUN cp ${NPM} /usr/bin/
RUN ${NPM} install leasot@latest -g
WORKDIR /root
COPY . .
RUN git clone https://github.com/ztobs/portwest-scraper-js.git && cd portwest-scraper-js
RUN ${NPM} install
RUN ${NODE} index.js


