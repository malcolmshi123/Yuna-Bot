const { Client, GuildMember, GatewayIntentBits } = require("discord.js");
const { Player, QueryType } = require("discord-player");
// const keepAlive = require('./server');

const client = new Client({
    intents: [ 
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent
    ]    
});

client.on("ready", () => {
    console.log("Ready!");
});

client.on("error", console.error);
client.on("warn", console.warn);

const player = new Player(client);

player.on("error", (queue, error) => {
    console.log(`[${queue.guild.name}] Error emitted from the queue: ${error.message}`);
});
player.on("connectionError", (queue, error) => {
    console.log(`[${queue.guild.name}] Error emitted from the connection: ${error.message}`);
});

player.on("trackStart", (queue, track) => {
    queue.metadata.send(`🎶 | Started playing: **${track.title}** in **${queue.connection.channel.name}**!`);
});
player.on("trackAdd", (queue, track) => {
    queue.metadata.send(`🎶 | Track **${track.title}** queued!`);
});
player.on("botDisconnect", (queue) => {
    queue.metadata.send(`❌ | Disconnected from **${queue.connection.channel.name}**, clearing queue!`);
});
player.on("channelEmpty", (queue) => {
    queue.metadata.send("❌ | bruh where the mans at");
});
player.on("queueEnd", (queue) => {
    queue.metadata.send("✅ | Queue finished!");
});

client.on("messageCreate", async (message) => {

    if (message.author.bot || !message.guild) return;
    if (!client.application?.owner) await client.application?.fetch();

    if (message.content === "=deploy" && message.author.id === client.application?.owner?.id) {
        await message.guild.commands.set([
            {
                name: "play",
                description: "play a song from YouTube",
                options: [
                    {
                        name: "query",
                        type: 3,
                        description: "the song you want to play",
                        required: true
                    }
                ]
            },
            {
                name: "skip",
                description: "skip to the next song"
            },
            /*{
                name: "queue",
                description: "see the queue"
            },*/
            {
                name: "stop",
                description: "stop the player"
            }
        ]);

        await message.reply("Deployed!");
    }
});

client.on("interactionCreate", async (interaction) => {

    if (!interaction.isCommand() || !interaction.guildId) return;

    if (!(interaction.member instanceof GuildMember) || !interaction.member.voice.channel) {
        return void interaction.reply({ content: "You are not in a voice channel!", ephemeral: true });
    }

    if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) {
        return void interaction.reply({ content: "You are not in my voice channel!", ephemeral: true });
    }

    if (interaction.commandName === "play") {

        await interaction.deferReply();

        const query = interaction.options.get("query").value;
        const searchResult = await player
            .search(query, {
                requestedBy: interaction.user,
                searchEngine: QueryType.AUTO
            })
            .catch(() => {});
        if (!searchResult || !searchResult.tracks.length) return void interaction.followUp({ content: "No results were found!" });

        const queue = player.createQueue(interaction.guild, {
            metadata: interaction.channel
        });

        try {
            if (!queue.connection) await queue.connect(interaction.member.voice.channel);
        } catch {
            void player.deleteQueue(interaction.guildId);
            return void interaction.followUp({ content: "Could not join your voice channel!" });
        }

        await interaction.followUp({ content: `⏱ | Loading your ${searchResult.playlist ? "playlist" : "track"}...` });
        searchResult.playlist ? queue.addTracks(searchResult.tracks) : queue.addTrack(searchResult.tracks[0]);

        if (!queue.playing) await queue.play();

    }

    else if (interaction.commandName === "skip") {

        await interaction.deferReply();

        const queue = player.getQueue(interaction.guildId);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" });

        const currentTrack = queue.current;
        const success = queue.skip();
        return void interaction.followUp({ content: success ? `✅ | Skipped **${currentTrack}**!` : "❌ | Something went wrong!" });
    }

    else if (interaction.commandName === "stop") {

        await interaction.deferReply();

        const queue = player.getQueue(interaction.guildId);
        if (!queue || !queue.playing) return void interaction.followUp({ content: "❌ | No music is being played!" });

        queue.destroy();
        return void interaction.followUp({ content: "🛑 | Stopped the player!" });
    }

    else {

        interaction.reply({ content: "Unknown command!", ephemeral: true });
    }
})

client.login(config.token); // config.json not added to repository for security purposes
// keepAlive();


