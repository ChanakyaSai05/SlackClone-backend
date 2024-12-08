import mongoose from 'mongoose';

const invitationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['channel', 'direct'],
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: String, // Email address
    required: true
  },
  channelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel'
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  token: {
    type: String,
    required: true
  }
}, { timestamps: true });

export default mongoose.model('Invitation', invitationSchema);