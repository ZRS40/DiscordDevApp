const express = require('express');
const { PermissionsBitField } = require('discord.js');
const client = require('../bot/bot.js');
const app = express();
const port = 3000;

app.use(express.json()); // Middleware to parse JSON bodies
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
        return {
            id: role.id,
            name: role.name,
            color: role.hexColor,
            permissions: role.permissions.bitfield.toString()
        };
    }).sort((a, b) => b.position - a.position);

    const allChannels = guild.channels.cache;

    const getChannelOverwrites = (channel) => {
        return channel.permissionOverwrites.cache
            .filter(o => o.type === 0) // type 0 for roles
            .map(o => ({
                id: o.id,
                allow: o.allow.bitfield.toString(),
                deny: o.deny.bitfield.toString()
            }));
    };

    // Process categories and their channels
    const categories = allChannels
        .filter(c => c.type === 4 /* GuildCategory */)
        .map(c => ({
            id: c.id,
            name: c.name,
            position: c.rawPosition,
            permissionOverwrites: getChannelOverwrites(c),
            channels: [],
        }))
        .sort((a, b) => a.position - b.position);

    const channelsWithoutCategory = [];

    allChannels
        .filter(c => c.type !== 4 /* GuildCategory */)
        .sort((a, b) => a.rawPosition - b.rawPosition)
        .forEach(channel => {
            const channelData = {
                id: channel.id,
                name: channel.name,
                type: channel.type,
                permissionOverwrites: getChannelOverwrites(channel)
            };
            const category = categories.find(c => c.id === channel.parentId);
            if (category) {
                category.channels.push(channelData);
            } else {
                channelsWithoutCategory.push(channelData);
            }
        });

    const structuredChannels = [...categories];
    if (channelsWithoutCategory.length > 0) {
        structuredChannels.push({
            id: null,
            name: 'No Category',
            channels: channelsWithoutCategory
        });
    }

    res.json({
        id: guild.id,
        name: guild.name,
        roles: roles,
        channels: structuredChannels
    });
});

app.get('/api/permissions', (req, res) => {
    const permissions = {};
    for (const [key, value] of Object.entries(PermissionsBitField.Flags)) {
        permissions[key] = value.toString();
    }
    res.json(permissions);
});

// Create a new role
app.post('/api/guilds/:id/roles', async (req, res) => {
    try {
        const guild = await client.guilds.fetch(req.params.id);
        if (!guild) {
            return res.status(404).json({ error: 'Guild not found' });
        }
        const { name, color, permissions } = req.body;
        const newRole = await guild.roles.create({
            name,
            color,
            permissions,
        });
        res.status(201).json(newRole);
    } catch (error) {
        console.error('Error creating role:', error);
        res.status(500).json({ error: 'Failed to create role', details: error.message });
    }
});

// Reorder roles
app.patch('/api/guilds/:id/roles', async (req, res) => {
    try {
        const guild = await client.guilds.fetch(req.params.id);
        if (!guild) {
            return res.status(404).json({ error: 'Guild not found' });
        }
        // req.body should be an array of { role: string (ID), position: number }
        const rolePositions = req.body;
        if (!Array.isArray(rolePositions)) {
            return res.status(400).json({ error: 'Request body must be an array of role positions.' });
        }

        await guild.roles.setPositions(rolePositions);
        res.json({ success: true, message: 'Roles reordered successfully.' });

    } catch (error) {
        console.error('Error reordering roles:', error);
        res.status(500).json({ error: 'Failed to reorder roles', details: error.message });
    }
});

// Edit a role
app.patch('/api/guilds/:id/roles/:roleId', async (req, res) => {
    try {
        const guild = await client.guilds.fetch(req.params.id);
        if (!guild) {
            return res.status(404).json({ error: 'Guild not found' });
        }
        const role = await guild.roles.fetch(req.params.roleId);
        if (!role) {
            return res.status(404).json({ error: 'Role not found' });
        }

        const { name, color, permissions } = req.body;
        const updatedRole = await role.edit({
            name,
            color,
            permissions,
        });
        res.json(updatedRole);
    } catch (error) {
        console.error('Error updating role:', error);
        res.status(500).json({ error: 'Failed to update role', details: error.message });
    }
});

// Delete a role
app.delete('/api/guilds/:id/roles/:roleId', async (req, res) => {
    try {
        const guild = await client.guilds.fetch(req.params.id);
        if (!guild) {
            return res.status(404).json({ error: 'Guild not found' });
        }
        const role = await guild.roles.fetch(req.params.roleId);
        if (!role) {
            return res.status(404).json({ error: 'Role not found' });
        }
        await role.delete();
        res.status(204).send(); // No Content
    } catch (error) {
        console.error('Error deleting role:', error);
        res.status(500).json({ error: 'Failed to delete role', details: error.message });
    }
});

// Update/Create a permission overwrite for a role on a channel
app.put('/api/guilds/:guildId/channels/:channelId/permissions/:roleId', async (req, res) => {
    try {
        const guild = await client.guilds.fetch(req.params.guildId);
        if (!guild) return res.status(404).json({ error: 'Guild not found' });

        const channel = await guild.channels.fetch(req.params.channelId);
        if (!channel) return res.status(404).json({ error: 'Channel not found' });

        const { allow, deny } = req.body;
        await channel.permissionOverwrites.edit(req.params.roleId, {
            allow: BigInt(allow),
            deny: BigInt(deny)
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating permission overwrite:', error);
        res.status(500).json({ error: 'Failed to update permission overwrite', details: error.message });
    }
});

// Delete a permission overwrite for a role on a channel
app.delete('/api/guilds/:guildId/channels/:channelId/permissions/:roleId', async (req, res) => {
    try {
        const guild = await client.guilds.fetch(req.params.guildId);
        if (!guild) return res.status(404).json({ error: 'Guild not found' });

        const channel = await guild.channels.fetch(req.params.channelId);
        if (!channel) return res.status(404).json({ error: 'Channel not found' });

        await channel.permissionOverwrites.delete(req.params.roleId);

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting permission overwrite:', error);
        res.status(500).json({ error: 'Failed to delete permission overwrite', details: error.message });
    }
});


app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
