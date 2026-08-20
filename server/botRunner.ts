import dotenv from 'dotenv';
import { initDiscordBot } from './discordBot';

dotenv.config();

async function main() {
  await initDiscordBot();
}

main().catch((e) => {
  console.error('[BotRunner] Fatal error:', e);
  process.exit(1);
});
