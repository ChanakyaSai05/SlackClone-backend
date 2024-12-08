import express from 'express';
import crypto from 'crypto';
import { authenticateToken } from '../middleware/auth.js';
import Invitation from '../models/Invitation.js';
import Channel from '../models/Channel.js';

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { type, recipientEmail, channelId } = req.body;
    const token = crypto.randomBytes(32).toString('hex');

    const invitation = new Invitation({
      type,
      sender: req.user.userId,
      recipient: recipientEmail,
      channelId,
      token
    });

    await invitation.save();

    // Here you would typically send an email with the invitation link
    // For demo purposes, we'll just return the token
    res.status(201).json({ 
      message: 'Invitation sent successfully',
      invitationToken: token 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error sending invitation' });
  }
});

router.post('/accept/:token', async (req, res) => {
  try {
    const invitation = await Invitation.findOne({ token: req.params.token });
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    if (invitation.type === 'channel' && invitation.channelId) {
      const channel = await Channel.findById(invitation.channelId);
      if (!channel) {
        return res.status(404).json({ message: 'Channel not found' });
      }
      
      // Add user to channel members
      channel.members.push(invitation.recipient);
      await channel.save();
    }

    invitation.status = 'accepted';
    await invitation.save();

    res.json({ message: 'Invitation accepted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error accepting invitation' });
  }
});

export default router;