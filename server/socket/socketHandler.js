const User = require('../models/User');

module.exports = (io) => {
    const users = new Map(); // Map user ID to socket ID

    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);



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

            console.log(`[SERVER] send_message event. Room: ${room}, Sender: ${socket.userId}`);

            if (room) {
                // 1. Emit to the conversation/group room (standard behavior)
                // Use io.to() instead of socket.to() to ensure everyone gets it, including sender (client handles dedupe)
                io.to(room).emit('new_message', message);
                console.log(`[SERVER] Emitted to room ${room}`);

                // 2. ALSO Emit to specific participants (Reliability layer)
                // This ensures that even if a user hasn't "joined" the room socket-wise
                // (e.g. they are online but looking at the dashboard without refreshing),
                // they still get the message.

                if (message.conversation && message.conversation.participants) {
                    message.conversation.participants.forEach(participant => {
                        const pId = participant._id || participant;
                        // Ensure we use string for comparison and room name
                        const pIdStr = pId.toString();

                        console.log(`[SERVER] Checking participant: ${pIdStr} (Socket User: ${socket.userId})`);

                        // Send to everyone via their personal room, including sender (reliability)
                        // Client deduplication will handle double receives
                        io.to(pIdStr).emit('new_message', message);
                        console.log(`[SERVER] Emitted to personal room ${pIdStr}`);
                    });
                }

                if (message.group && message.group.members) {
                    message.group.members.forEach(member => {
                        const mId = member._id || member;
                        const mIdStr = mId.toString();
                        io.to(mIdStr).emit('new_message', message);
                        console.log(`[SERVER] Emitted to personal room ${mIdStr} (Group)`);
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
