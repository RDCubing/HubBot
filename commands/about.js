const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("about")
        .setDescription("Shows information about this bot"),

    async execute(interaction) {
        await interaction.reply({
            embeds: [
                {
                    title: "🤖 Community Bot",
                    color: 0x2b2d31,
                    description: 
`I am a community bot designed exclusively for GDCR!

Features:
- Server rules & information
- Suggestions & reports system
- Ticket support (coming soon)
- GitHub / apps integration (planned)

- Built using Discord.js
- Made specifically for this community`,
                    footer: {
                        text: "GDCR Community Bot"
                    }
                }
            ]
        });
    }
};