#!/bin/bash

git pull

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

if [ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 24 ]; then
    nvm use 24
fi

pnpm install
node ./deploy-commands.js

pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js
