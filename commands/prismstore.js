const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("prismstore")
        .setDescription("PrismStore system")
        .addSubcommand(sub =>
            sub
                .setName("update")
                .setDescription("Check latest PrismStore update")
        ),

    async execute(interaction) {

        const res = await fetch(
            "https://raw.githubusercontent.com/RDCubing/geekhubapi/main/updateprism.json"
        );

        const data = await res.json();

        // Support PrismStore array or flat object structure
        let app = data.PrismStore ?? data;
        if (Array.isArray(app)) {
            app = app.find(item => item.TopApp === "Yes") || app[0];
        }

        const version = app.Version || "Unknown";
        const title = app.Name || app.Title || "PrismStore";
        const description = (app.Message ? app.Message + "\n\n" : "") + (app.Changelog || app.Description || "No description available.");
        const downloadUrl = app.DownloadUrl || "https://github.com/RDCubing";

        return interaction.reply({
            embeds: [
                {
                    title: `${title} ${version}`,
                    color: 0x2b2d31,
                    description: description,

                    fields: [
                        {
                            name: "Version",
                            value: version,
                            inline: true
                        },
                        {
                            name: "Name",
                            value: title,
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
                            url: downloadUrl
                        }
                    ]
                }
            ]
        });
    }
};