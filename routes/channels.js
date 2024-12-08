import express from 'express';
import Channel from '../models/Channel.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get all channels
router.get('/', async (req, res) => {
  try {
    const channels = await Channel.find({ members: req.user.userId })
      .populate('members', 'name email status')
      .populate('createdBy', 'name email');
    res.json(channels);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching channels' });
  }
});

// Create new channel
router.post('/', async (req, res) => {
  try {
    const { name, description, isPrivate, members } = req.body;
    const channel = new Channel({
      name,
      description,
      isPrivate,
      members: [...members, req.user.userId],
      createdBy: req.user.userId
    });
    await channel.save();
    
    const populatedChannel = await channel
      .populate('members', 'name email status')
      .populate('createdBy', 'name email');
      
    res.status(201).json(populatedChannel);
  } catch (error) {
    res.status(500).json({ message: 'Error creating channel' });
  }
});

// Add member to channel
router.post('/:channelId/members', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { userId } = req.body;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    if (!channel.members.includes(userId)) {
      channel.members.push(userId);
      await channel.save();
    }

    const populatedChannel = await channel
      .populate('members', 'name email status')
      .populate('createdBy', 'name email');

    res.json(populatedChannel);
  } catch (error) {
    res.status(500).json({ message: 'Error adding member to channel' });
  }
});

export default router;