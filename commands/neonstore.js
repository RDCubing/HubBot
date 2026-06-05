const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("neonstore")
        .setDescription("NeonStore system")
        .addSubcommand(sub =>
            sub
                .setName("update")
                .setDescription("Check latest NeonStore update")
        ),

    async execute(interaction) {

        const res = await fetch(
            "https://raw.githubusercontent.com/RDCubing/geekhubapi/main/update.json"
        );

        const data = await res.json();

        return interaction.reply({
            embeds: [
                {
                    title: `NeonStore ${data.Version}`,
                    color: 0x2b2d31,
                    description: data.Message + "\n\n" + data.Changelog,

                    fields: [
                        {
                            name: "Version",
                            value: data.Version,
                            inline: true
                        },
                        {
                            name: "Name",
                            value: data.Name,
                            inline: true
                        }
                    ]
                }
            ],
            components: [
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: 5,
                            label: "Download Update",
                            url: data.DownloadUrl
                        }
                    ]
                }
            ]
        });
    }
};