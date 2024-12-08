import express from 'express';
import Message from '../models/Message.js';
import Channel from '../models/Channel.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get messages for a channel
router.get('/channel/:channelId', async (req, res) => {
  try {
    const channelId = req.params.channelId;
    
    // Handle DM channels
    if (channelId.startsWith('dm-')) {
      const otherUserId = channelId.replace('dm-', '');
      const messages = await Message.find({
        $or: [
          { sender: req.user.userId, recipient: otherUserId },
          { sender: otherUserId, recipient: req.user.userId }
        ]
      })
      .populate('sender', 'name email')
      .sort({ createdAt: -1 })
      .limit(50);
      
      return res.json(messages);
    }
    
    // Handle regular channels
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // Verify user is a member of the channel
    if (!channel.members.includes(req.user.userId)) {
      return res.status(403).json({ message: 'Not authorized to view messages' });
    }

    const messages = await Message.find({ channel: channelId })
      .populate('sender', 'name email')
      .sort({ createdAt: -1 })
      .limit(50);
      
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Error fetching messages' });
  }
});

// Send a message
router.post('/', async (req, res) => {
  try {
    const { content, channelId, attachments } = req.body;
    
    // Handle DM messages
    if (channelId.startsWith('dm-')) {
      const recipientId = channelId.replace('dm-', '');
      const message = new Message({
        content,
        sender: req.user.userId,
        recipient: recipientId,
        attachments
      });
      await message.save();
      const populatedMessage = await message.populate('sender', 'name email');
      return res.status(201).json(populatedMessage);
    }
    
    // Handle channel messages
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // Verify user is a member of the channel
    if (!channel.members.includes(req.user.userId)) {
      return res.status(403).json({ message: 'Not authorized to send messages' });
    }

    const message = new Message({
      content,
      sender: req.user.userId,
      channel: channelId,
      attachments
    });
    
    await message.save();
    const populatedMessage = await message.populate('sender', 'name email');
    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Error sending message' });
  }
});

export default router;