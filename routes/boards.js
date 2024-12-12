import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import Board from '../models/Board.js';
import Section from '../models/Section.js';
import Card from '../models/Card.js';

const router = express.Router();

router.use(authenticateToken);

// // Get all boards for a channel
// router.get('/channel/:channelId', async (req, res) => {
//   try {
//     const boards = await Board.find({ channelId: req.params.channelId })
//       .populate('members', 'name email')
//       .populate('createdBy', 'name email');
//     res.json(boards);
//   } catch (error) {
//     console.error('Error fetching boards:', error);
//     res.status(500).json({ message: 'Error fetching boards' });
//   }
// });
// Get all boards for a channel where the user is a member
router.get('/channel/:channelId', async (req, res) => {
  try {
    const userId = req.user.userId; // Assuming `req.user._id` contains the authenticated user's ID
    console.log('userId:', userId);

    // Find boards in the specified channel where the user is a member
    const boards = await Board.find({
      channelId: req.params.channelId,
      members: { $in: [userId] }, // Ensure the user's ID is in the members array
    })
      .populate('members', 'name email') // Populate members field with their name and email
      .populate('createdBy', 'name email'); // Populate createdBy field with name and email

    res.json(boards); // Return the filtered boards
  } catch (error) {
    console.error('Error fetching boards:', error);
    res.status(500).json({ message: 'Error fetching boards' });
  }
});


// Create new board
router.post('/', async (req, res) => {
  try {
    const { name, description, channelId, members } = req.body;
    
    // Create the board
    const board = new Board({
      name,
      description,
      channelId,
      members: [...new Set([...members, req.user.userId])], // Ensure unique members
      createdBy: req.user.userId
    });
    
    await board.save();
    
    // Create default sections
    const defaultSections = ['To Do', 'In Progress', 'Done'];
    await Promise.all(defaultSections.map((name, index) => {
      return Section.create({
        name,
        boardId: board._id,
        order: index
      });
    }));

    // Populate the board with member and creator details
    // const populatedBoard = await board
    //   .populate('members', 'name email')
    //   .populate('createdBy', 'name email');
    const populatedBoard = await Board.findById(board._id).populate('members', 'name email').populate('createdBy', 'name email');
      
    res.status(201).json(populatedBoard);
  } catch (error) {
    console.error('Error creating board:', error);
    res.status(500).json({ message: 'Error creating board' });
  }
});

// Get a specific board
router.get('/:boardId', async (req, res) => {
  try {
    const board = await Board.findById(req.params.boardId)
      .populate('members', 'name email')
      .populate('createdBy', 'name email');
      
    if (!board) {
      return res.status(404).json({ message: 'Board not found' });
    }
    
    res.json(board);
  } catch (error) {
    console.error('Error fetching board:', error);
    res.status(500).json({ message: 'Error fetching board' });
  }
});

// Update board
router.patch('/:boardId', async (req, res) => {
  try {
    const { boardId } = req.params;
    const { name, description, members } = req.body;

    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: 'Board not found' });
    }

    // Get removed members (were in board.members but not in new members array)
    const removedMembers = board.members.filter(m => !members.includes(m.toString()));

    // Update board
    const updatedBoard = await Board.findByIdAndUpdate(
      boardId,
      { name, description, members },
      { new: true }
    ).populate('members', 'name email');

    // If members were removed, remove them from all cards in this board
    if (removedMembers.length > 0) {
      await Card.updateMany(
        { boardId },
        { $pull: { assignedTo: { $in: removedMembers } } }
      );
    }

    res.json(updatedBoard);
  } catch (error) {
    console.error('Error updating board:', error);
    res.status(500).json({ message: 'Error updating board' });
  }
});

// Add member to board
router.post('/:boardId/members', async (req, res) => {
  try {
    const { userId } = req.body;
    const board = await Board.findById(req.params.boardId);
    
    if (!board) {
      return res.status(404).json({ message: 'Board not found' });
    }

    if (!board.members.includes(userId)) {
      board.members.push(userId);
      await board.save();
    }

    const populatedBoard = await board
      .populate('members', 'name email')
      .populate('createdBy', 'name email');

    res.json(populatedBoard);
  } catch (error) {
    console.error('Error adding member to board:', error);
    res.status(500).json({ message: 'Error adding member to board' });
  }
});
router.delete('/:boardId', async (req, res) => {
  try {
    const { boardId } = req.params;

    // Delete all cards in the board
    await Card.deleteMany({ boardId });
    
    // Delete all sections in the board
    await Section.deleteMany({ boardId });
    
    // Delete the board
    await Board.findByIdAndDelete(boardId);

    res.json({ message: 'Board and all related data deleted successfully' });
  } catch (error) {
    console.error('Error deleting board:', error);
    res.status(500).json({ message: 'Error deleting board' });
  }
});

export default router;