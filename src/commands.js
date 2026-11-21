const ACCENT = 0x0081fb;
const ERROR = 0xe5484d;

export const commands = [
  {
    definition: {
      name: "ping",
      description: "Check that the bot is online.",
    },
    execute: ({ startedAt }) => ({
      embeds: [
        {
          title: "Pong",
          description: `Responded in **${Math.max(1, Math.round(performance.now() - startedAt))} ms**`,
          color: ACCENT,
          footer: { text: "openXR bot" },
        },
      ],
    }),
  },
  {
    definition: {
      name: "help",
      description: "List the available commands.",
    },
    execute: () => ({
      embeds: [
        {
          title: "openXR bot",
          description: "Available slash commands",
          color: ACCENT,
          fields: commands.map(({ definition }) => ({
            name: `/${definition.name}`,
            value: definition.description,
            inline: false,
          })),
          footer: { text: "Slash commands only" },
        },
      ],
    }),
  },
];

export { ERROR };
