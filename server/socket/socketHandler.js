const User = require('../models/User');

module.exports = (io) => {
    const users = new Map(); // Map user ID to socket ID

    io.on('connection', (socket) => {
        console.log('[SOCKET] User connected:', socket.id);
        console.log('[SOCKET] Transport:', socket.conn.transport.name);
        console.log('[SOCKET] Total connections:', io.engine.clientsCount);


        // Join a conversation room
        socket.on('join_conversation', (conversationId) => {
            const room = String(conversationId);
            socket.join(room);
            console.log(`[JOIN] Socket ${socket.id} joined room: ${room}`);
            console.log(`[JOIN] Room ${room} now has ${io.sockets.adapter.rooms.get(room)?.size || 0} members`);
        });

        // Leave a conversation room
        socket.on('leave_conversation', (conversationId) => {
            const room = String(conversationId);
            socket.leave(room);
        });

        // Mark messages as read
        socket.on('mark_read', ({ conversationId, messageId }) => {
            // We can broadcast this to the other user so they see "Read" status immediately
            // For now, we just acknowledge it or broadcast to the room
            const room = String(conversationId);
            socket.to(room).emit('message_read', { conversationId, messageId, userId: socket.userId });
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
        socket.on('send_message', async (message) => {
            try {
                // Handle both populated objects and plain IDs
                const conversationId = message.conversation?._id || message.conversation || message.conversationId;
                const groupId = message.group?._id || message.group || message.groupId;
                const room = conversationId || groupId;

                console.log(`[SERVER] send_message event. Room: ${room}, Sender: ${socket.userId}`);

                if (room) {
                    const roomStr = String(room);
                    // 1. Emit to the conversation/group room (standard behavior)
                    console.log(`[SERVER] Emitting to room ${roomStr}. Participants count: ${io.sockets.adapter.rooms.get(roomStr)?.size || 0}`);
                    io.to(roomStr).emit('new_message', message);
                    console.log(`[SERVER] Emitted to room ${roomStr}`);

                    // 2. ALSO Emit to specific participants (Reliability layer)
                    // CRITICAL FIX: If participants are missing (e.g. not populated), FETCH them.
                    let participants = [];

                    if (conversationId) {
                        if (message.conversation && message.conversation.participants && message.conversation.participants.length > 0) {
                            participants = message.conversation.participants;
                        } else {
                            // Fallback: Fetch from DB
                            const Conversation = require('../models/Conversation'); // Lazy load
                            const conv = await Conversation.findById(conversationId);
                            if (conv) participants = conv.participants;
                            console.log(`[SERVER] Fetched ${participants.length} participants from DB for reliability`);
                        }
                    } else if (groupId) {
                        if (message.group && message.group.members && message.group.members.length > 0) {
                            participants = message.group.members;
                        } else {
                            // Fallback: Fetch from DB
                            const Group = require('../models/Group'); // Lazy load
                            const grp = await Group.findById(groupId);
                            if (grp) participants = grp.members;
                            console.log(`[SERVER] Fetched ${participants.length} members from DB for reliability`);
                        }
                    }

                    if (participants && participants.length > 0) {
                        participants.forEach(p => {
                            // p might be an object (populated) or just an ID
                            const pId = p._id || p;
                            const pIdStr = String(pId);

                            // Send to everyone via their personal room
                            io.to(pIdStr).emit('new_message', message);
                        });
                        console.log(`[SERVER] Reliability broadcast sent to ${participants.length} users via personal rooms`);
                    }
                } else {
                    console.error('No room found for message:', message);
                }
            } catch (err) {
                console.error('[SERVER] Socket send_message error:', err);
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
