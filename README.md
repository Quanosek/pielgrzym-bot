# <img src="images/avatar.png" alt="" width="40" height="40" align="left"> Pielgrzym

### Add this bot to your server:

- General Permissions:
  - Manage Server
  - Manage Roles
  - Manage Channels
  - Create Instant Invite
  - View Channels

- Text Permissions:
  - Send Messages
  - Embed Links
  - Read Message History
  - Add Reactions
  - Use Slash Commands

- Voice Permissions
  - Connect

https://discord.com/oauth2/authorize?client_id=1467574765513609399&permissions=2417052785&integration_type=0&scope=bot

### How to run source code locally:

- [Node.js](https://nodejs.org/en/download) >= 24 required
- [pnpm package manager](https://pnpm.io/installation) >= 10 required

```bash
pnpm install && pnpm dev
```

### How to start bot in production:

- [nvm (Node Version Manager)](https://github.com/nvm-sh/nvm) is required
- [pm2 (Process Manager)](https://pm2.io/docs/runtime/guide/installation/) is required

```bash
pnpm install && bash ./run.sh
```

```bash
# To enable clusters to run on startup paste:
pm2 startup
# paste given command and run:
pm2 save
```
