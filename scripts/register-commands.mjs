import { commands } from "../src/commands.js";

const applicationId = process.env.DISCORD_APPLICATION_ID;
const botToken = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!applicationId || !botToken) {
  console.error("Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN first.");
  process.exit(1);
}

const names = new Set(commands.map(({ definition }) => definition.name));
if (names.size !== commands.length) {
  console.error("Command names must be unique.");
  process.exit(1);
}

const url = guildId
  ? `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`
  : `https://discord.com/api/v10/applications/${applicationId}/commands`;

const response = await fetch(url, {
  method: "PUT",
  headers: {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(commands.map(({ definition }) => definition)),
});

const payload = await response.json().catch(() => null);
if (!response.ok) {
  console.error(`Discord API ${response.status}:`, payload ?? "(no body)");
  process.exit(1);
}

console.log(`Registered ${payload.length} command(s) ${guildId ? `in guild ${guildId}` : "globally"}:`);
for (const command of payload) {
  console.log(`  /${command.name}`);
}
