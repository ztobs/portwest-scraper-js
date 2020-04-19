FROM debian:stretch-slim
ENV NODE_VERSION=12.16.0
ENV NPM="/root/.nvm/versions/node/v${NODE_VERSION}/bin/npm"
RUN apt-get update && \
    apt-get install wget curl ca-certificates rsync git -y
RUN wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.33.2/install.sh | bash
ENV NVM_DIR=/root/.nvm
RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" &&  nvm use v${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm alias default v${NODE_VERSION}
RUN cp /root/.nvm/versions/node/v${NODE_VERSION}/bin/node /usr/bin/
RUN cp /root/.nvm/versions/node/v${NODE_VERSION}/bin/npm /usr/bin/
RUN ${NPM} install leasot@latest -g
WORKDIR /root
COPY . .
RUN git clone https://github.com/ztobs/portwest-scraper-js.git && cd portwest-scraper-js
RUN ${NPM} install
RUN ${NPM} run scrap


