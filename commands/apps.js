const { SlashCommandBuilder } = require("discord.js");

const PAGE_SIZE = 5;

const formatApp = (app) =>
    `**${app.Title}**
ID: ${app.Id || "no-id"}
Version: ${app.Version}`;

function paginate(items, page) {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
}

function buildButtons(type, page, totalPages) {
    return [
        {
            type: 1,
            components: [
                {
                    type: 2,
                    style: 1,
                    label: "Previous",
                    custom_id: `${type}_prev_${page}`,
                    disabled: page <= 1
                },
                {
                    type: 2,
                    style: 1,
                    label: "Next",
                    custom_id: `${type}_next_${page}`,
                    disabled: page >= totalPages
                }
            ]
        }
    ];
}

const normalize = (str) =>
    (str || "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .trim();

module.exports = {
    data: new SlashCommandBuilder()
        .setName("apps")
        .setDescription("GeekHub apps system")
        .addSubcommand(sub =>
            sub.setName("count").setDescription("Show total apps")
        )
        .addSubcommand(sub =>
            sub.setName("list").setDescription("List all apps")
        )
        .addSubcommand(sub =>
            sub.setName("top").setDescription("Show top featured apps")
        )
        .addSubcommand(sub =>
            sub.setName("download")
                .setDescription("Get download link for an app")
                .addStringOption(option =>
                    option.setName("id")
                        .setDescription("App Title")
                        .setRequired(true)
                )
        ),

    async execute(interaction) {

        const res = await fetch(
            "https://raw.githubusercontent.com/RDCubing/geekhubapi/main/projects.json"
        );

        const data = await res.json();

        const allApps = [
            ...(data.NeonStore || []),
            ...(data.OtherPlatforms || [])
        ];

        const sub = interaction.options.getSubcommand();

        /* ---------------- COUNT ---------------- */
        if (sub === "count") {
            return interaction.reply({
                embeds: [
                    {
                        title: "GeekHub Apps",
                        color: 0x2b2d31,
                        description: `There are currently **${allApps.length} apps** available.`
                    }
                ]
            });
        }

        /* ---------------- LIST ---------------- */
        if (sub === "list") {

            const page = 1;
            const totalPages = Math.ceil(allApps.length / PAGE_SIZE);

            const items = paginate(allApps, page);

            return interaction.reply({
                embeds: [
                    {
                        title: "GeekHub App List",
                        color: 0x2b2d31,
                        description: items.map(formatApp).join("\n\n"),
                        footer: {
                            text: `Page ${page}/${totalPages} • ${allApps.length} apps`
                        }
                    }
                ],
                components: buildButtons("list", page, totalPages)
            });
        }

        /* ---------------- TOP ---------------- */
        if (sub === "top") {

            const topApps = allApps.filter(app => app.TopApp === "Yes");

            if (!topApps.length) {
                return interaction.reply({
                    content: "No top apps found.",
                    ephemeral: true
                });
            }

            const page = 1;
            const totalPages = Math.ceil(topApps.length / PAGE_SIZE);

            const items = paginate(topApps, page);

            return interaction.reply({
                embeds: [
                    {
                        title: "Top Apps",
                        color: 0x2b2d31,
                        description: items.map(formatApp).join("\n\n"),
                        footer: {
                            text: `Page ${page}/${totalPages} • ${topApps.length} featured apps`
                        }
                    }
                ],
                components: buildButtons("top", page, totalPages)
            });
        }

        /* ---------------- DOWNLOAD ---------------- */
        if (sub === "download") {

            const query = normalize(interaction.options.getString("id"));

            const app = allApps.find(a =>
                normalize(a.Title) === query
            );

            if (!app) {
                return interaction.reply({
                    content: `App "${interaction.options.getString("id")}" not found.`,
                    ephemeral: true
                });
            }

            return interaction.reply({
                embeds: [
                    {
                        title: app.Title,
                        color: 0x2b2d31,
                        description: app.Description,

                        ...(app.ImagePath ? {
                            thumbnail: {
                                url: app.ImagePath
                            }
                        } : {}),

                        fields: [
                            {
                                name: "Version",
                                value: app.Version,
                                inline: true
                            },
                            {
                                name: "Framework",
                                value: app.Framework,
                                inline: true
                            }
                        ],

                        footer: {
                            text: `ID: ${app.Id || "no-id"}`
                        }
                    }
                ],
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                type: 2,
                                style: 5,
                                label: "Download",
                                url: app.DownloadUrl
                            },
                            {
                                type: 2,
                                style: 5,
                                label: "Source",
                                url: app.SourceUrl || app.DownloadUrl
                            }
                        ]
                    }
                ]
            });
        }
    }
};