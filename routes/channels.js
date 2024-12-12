import express from "express";
import Board from "../models/Board.js";
import Section from "../models/Section.js";
import Card from "../models/Card.js";
import Channel from "../models/Channel.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken);

// Get all channels
router.get("/", async (req, res) => {
  try {
    const channels = await Channel.find({ members: req.user.userId })
      .populate("members", "name email status")
      .populate("createdBy", "name email");
    res.json(channels);
  } catch (error) {
    res.status(500).json({ message: "Error fetching channels" });
  }
});

// Create new channel
router.post("/", async (req, res) => {
  try {
    const { name, description, isPrivate, members } = req.body;
    const channel = new Channel({
      name,
      description,
      isPrivate,
      members: [...members, req.user.userId],
      createdBy: req.user.userId,
    });
    await channel.save();

    // const populatedChannel = await channel
    //   .populate("members", "name email status")
    //   .populate("createdBy", "name email");
    // Populate fields properly after saving
    const populatedChannel = await Channel.findById(channel._id)
      .populate("members", "name email status")
      .populate("createdBy", "name email");

    res.status(201).json(populatedChannel);
  } catch (error) {
    res.status(500).json({ message: "Error creating channel" });
  }
});

// Add member to channel
router.post("/:channelId/members", async (req, res) => {
  try {
    const { channelId } = req.params;
    const { userId } = req.body;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    if (!channel.members.includes(userId)) {
      channel.members.push(userId);
      await channel.save();
    }

    const populatedChannel = await channel
      .populate("members", "name email status")
      .populate("createdBy", "name email");

    res.json(populatedChannel);
  } catch (error) {
    res.status(500).json({ message: "Error adding member to channel" });
  }
});
// Update channel
router.patch("/:channelId", async (req, res) => {
  try {
    const { channelId } = req.params;
    const { name, description, members } = req.body;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    // Get removed members (were in channel.members but not in new members array)
    const removedMembers = channel.members.filter(
      (m) => !members.includes(m.toString())
    );

    // Update channel
    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      { name, description, members },
      { new: true }
    ).populate("members", "name email status");

    // If members were removed, remove them from all boards, sections, and cards
    if (removedMembers.length > 0) {
      // Get all boards in this channel
      const boards = await Board.find({ channelId });

      for (const board of boards) {
        // Remove members from board
        board.members = board.members.filter(
          (m) => !removedMembers.includes(m.toString())
        );
        await board.save();

        // Remove members from cards in this board
        await Card.updateMany(
          { boardId: board._id },
          { $pull: { assignedTo: { $in: removedMembers } } }
        );
      }
    }

    res.json(updatedChannel);
  } catch (error) {
    console.error("Error updating channel:", error);
    res.status(500).json({ message: "Error updating channel" });
  }
});
// Delete channel
router.delete("/:channelId", async (req, res) => {
  try {
    const { channelId } = req.params;

    // Get all boards in this channel
    const boards = await Board.find({ channelId });

    // Delete all related data
    for (const board of boards) {
      // Delete all cards in each board
      await Card.deleteMany({ boardId: board._id });

      // Delete all sections in each board
      await Section.deleteMany({ boardId: board._id });
    }

    // Delete all boards
    await Board.deleteMany({ channelId });

    // Delete the channel
    await Channel.findByIdAndDelete(channelId);

    res.json({ message: "Channel and all related data deleted successfully" });
  } catch (error) {
    console.error("Error deleting channel:", error);
    res.status(500).json({ message: "Error deleting channel" });
  }
});

export default router;
