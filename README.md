# discord-messenger-plug-and-play-extended

Extended plug-and-play Discord tool (Node.js + Express) — features:
1. Send messages to channels (token per-request or server-side BOT_TOKEN).
2. Prove authority by validating bot tokens (you paste tokens; app fetches /users/@me to prove access).
3. Generate an invite link for another bot (you provide the other bot's client ID). After proving ownership of *both* bots (you paste both tokens), the app can post the invite link into a chosen channel so server operators can click it and add the other bot.
   - IMPORTANT: A bot **cannot** directly add another bot to a guild via Discord API. The app posts the OAuth2 invite link for the other bot to the chosen channel.
4. Change the bot's nickname in a selected guild (uses same token).
5. Register and enable a `/chat` slash command that replies using OpenAI. Requires a server-side BOT_TOKEN (for the bot to connect) and `OPENAI_API_KEY` in .env.

## Security notes
- This app accepts **bot tokens only**. Do **not** paste user account tokens.
- The app does **not** persist tokens; tokens are used per-request. Do not deploy this in production without securing transport (HTTPS) and using OAuth2 instead of pasted tokens.
- When enabling the AI chat feature, the server must have a BOT_TOKEN in `.env` so it can connect with the Discord gateway and respond to interactions.

## Quick start
1. Install dependencies:
```bash
npm install
```
2. Copy `.env.example` -> `.env` and fill values (BOT_TOKEN for AI feature, OPENAI_API_KEY if you want AI replies).
3. Start:
```bash
npm start
```
4. Open `http://localhost:3000`

## Deploying to Render
- Create a Web Service, build `npm install`, start `npm start`. Add BOT_TOKEN and OPENAI_API_KEY as environment variables if you enable AI `/chat` command.

## How the "add bot" flow works
1. Provide Token A (your controlling bot) and Token B (the other bot). The app validates both tokens by calling `GET /users/@me`.
2. The app builds an OAuth2 invite link for Bot B using its client ID and desired permissions.
3. The app sends that invite link as a message into the chosen channel using Token A. A human with Manage Server can then click the link to add Bot B.

