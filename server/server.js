const express = require('express');
const client = require('../bot/bot.js');
const app = express();
const port = 3000;

app.use(express.static('public'));

app.get('/api/guilds', (req, res) => {
    const guilds = client.guilds.cache.map(guild => {
        return {
            id: guild.id,
            name: guild.name
        };
    });
    res.json(guilds);
});

app.get('/api/guilds/:id', (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
    }

    const roles = guild.roles.cache.map(role => {
        return { id: role.id, name: role.name };
    });

    const channels = guild.channels.cache.map(channel => {
        return { id: channel.id, name: channel.name, type: channel.type };
    });

    res.json({
        id: guild.id,
        name: guild.name,
        roles: roles,
        channels: channels
    });
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
