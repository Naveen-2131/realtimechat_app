const User = require('../models/User');

module.exports = (io) => {
    const users = new Map(); // Map user ID to socket ID

    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        // User joins with their ID
        socket.on('join', async (userId) => {
            users.set(userId, socket.id);
            // Store user info in socket for disconnect handling
            socket.userId = userId;

            // Update user's lastSeen and status in database
            try {
                await User.findByIdAndUpdate(userId, {
                    status: 'online',
                    lastSeen: new Date()
                });
            } catch (error) {
                console.error('Error updating user status:', error);
            }

            io.emit('user_status_change', { userId, status: 'online' });
            console.log(`User ${userId} is online`);
        });

        // Join a conversation room
        socket.on('join_conversation', (conversationId) => {
            socket.join(conversationId);
            console.log(`[JOIN] Socket ${socket.id} joined room: ${conversationId}`);
            console.log(`[JOIN] Room ${conversationId} now has ${io.sockets.adapter.rooms.get(conversationId)?.size || 0} members`);
        });

        // Leave a conversation room
        socket.on('leave_conversation', (conversationId) => {
            socket.leave(conversationId);
        });



        // Typing indicators
        socket.on('typing', (room) => {
            // Broadcast to room except sender
            socket.to(room).emit('typing', { room, user: socket.userId });
            // Note: In a real app, we'd want the username here. 
            // Since we only stored userId in socket.userId, we might need to fetch it or store it in join.
            // For now, let's assume the client sends the username or we just show "Someone is typing"
            // Actually, let's update the client to send the username in the join event or just use the userId to look up.
            // Better yet, let's trust the client to send the username in the typing event if we want it simple,
            // OR, let's update the join event to store username.
        });

        // Let's refine the typing event to match what ChatDashboard expects
        // ChatDashboard expects: socket.on('typing', ({ room, user: typingUsername }) => { ... })
        // So we should emit: { room, user: username }

        // Let's update the join listener to store username too
        socket.on('join_with_data', async ({ userId, username }) => {
            users.set(userId, socket.id);
            socket.userId = userId;
            socket.username = username;

            // Join a personal room for notifications/direct messages
            socket.join(userId);

            // Update lastSeen in database
            try {
                await User.findByIdAndUpdate(userId, {
                    status: 'online',
                    lastSeen: new Date()
                });
            } catch (error) {
                console.error('Error updating user status:', error);
            }

            io.emit('user_status_change', { userId, status: 'online' });
        });

        socket.on('typing', (room) => {
            if (socket.username) {
                socket.to(room).emit('typing', { room, user: socket.username });
            }
        });

        socket.on('stop_typing', (room) => {
            socket.to(room).emit('stop_typing', { room });
        });

        // Get online users list
        socket.on('get_online_users', () => {
            const onlineUserIds = Array.from(users.keys());
            socket.emit('online_users_list', onlineUserIds);
        });

        // Send message
        socket.on('send_message', (message) => {
            // Handle both populated objects and plain IDs
            const conversationId = message.conversation?._id || message.conversation || message.conversationId;
            const groupId = message.group?._id || message.group || message.groupId;
            const room = conversationId || groupId;

            if (room) {
                // 1. Emit to the conversation/group room (standard behavior)
                // This reaches everyone who has "joined" the chat actively
                socket.to(room).emit('new_message', message);

                // 2. ALSO Emit to specific participants (Reliability layer)
                // This ensures that even if a user hasn't "joined" the room socket-wise 
                // (e.g. they are online but looking at the dashboard without refreshing), 
                // they still get the message.

                if (message.conversation && message.conversation.participants) {
                    message.conversation.participants.forEach(participant => {
                        const pId = participant._id || participant;
                        // Don't send back to sender via this channel (optional, but good for reducing specific noise)
                        if (pId.toString() !== socket.userId) {
                            io.to(pId.toString()).emit('new_message', message);
                        }
                    });
                }

                if (message.group && message.group.members) {
                    message.group.members.forEach(member => {
                        const mId = member._id || member;
                        if (mId.toString() !== socket.userId) {
                            io.to(mId.toString()).emit('new_message', message);
                        }
                    });
                }
            } else {
                console.error('No room found for message:', message);
            }
        });

        // Disconnect
        socket.on('disconnect', async () => {
            let userId = socket.userId;

            // Fallback if socket.userId wasn't set (should be set in join)
            if (!userId) {
                for (const [key, value] of users.entries()) {
                    if (value === socket.id) {
                        userId = key;
                        break;
                    }
                }
            }

            if (userId) {
                users.delete(userId);

                // Update user's lastSeen and status in database
                try {
                    await User.findByIdAndUpdate(userId, {
                        status: 'offline',
                        lastSeen: new Date()
                    });
                } catch (error) {
                    console.error('Error updating user lastSeen:', error);
                }

                io.emit('user_status_change', { userId, status: 'offline' });
            }
            console.log('User disconnected:', socket.id);
        });
    });
};
