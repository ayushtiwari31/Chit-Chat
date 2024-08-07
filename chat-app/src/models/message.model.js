import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    conversationId: {
        type: String,
    },
    senderId: {
        type: String
    },
    message: {
        type: String
    }
}, {
  timestamps: true,
});

export const Messages = mongoose.model('Messages', messageSchema);


