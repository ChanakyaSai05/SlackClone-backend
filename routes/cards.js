import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import Card from '../models/Card.js';

const router = express.Router();

router.use(authenticateToken);

// Get all cards for a board
router.get('/board/:boardId', async (req, res) => {
  try {
    const cards = await Card.find({ boardId: req.params.boardId })
      .populate('assignedTo', 'name email')
      .sort('order');
    res.json(cards);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cards' });
  }
});

// Create new card
router.post('/', async (req, res) => {
  try {
    const { title, description, sectionId, boardId, assignedTo, priority, dueDate, labels } = req.body;
    
    const lastCard = await Card.findOne({ sectionId })
      .sort('-order');
    
    const card = new Card({
      title,
      description,
      sectionId,
      boardId,
      assignedTo,
      priority,
      dueDate,
      labels,
      order: lastCard ? lastCard.order + 1 : 0
    });
    
    await card.save();
    const populatedCard = await card.populate('assignedTo', 'name email');
    res.status(201).json(populatedCard);
  } catch (error) {
    res.status(500).json({ message: 'Error creating card' });
  }
});

// Update card
router.patch('/:cardId', async (req, res) => {
  try {
    const updates = req.body;
    const card = await Card.findByIdAndUpdate(
      req.params.cardId,
      updates,
      { new: true }
    ).populate('assignedTo', 'name email');
    
    if (!card) {
      return res.status(404).json({ message: 'Card not found' });
    }
    
    res.json(card);
  } catch (error) {
    res.status(500).json({ message: 'Error updating card' });
  }
});

// Delete card
router.delete('/:cardId', async (req, res) => {
  try {
    const card = await Card.findByIdAndDelete(req.params.cardId);
    
    if (!card) {
      return res.status(404).json({ message: 'Card not found' });
    }
    
    res.json({ message: 'Card deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting card' });
  }
});

// Move card
router.patch('/:cardId/move', async (req, res) => {
  try {
    const { newSectionId, newOrder } = req.body;
    const card = await Card.findById(req.params.cardId);
    
    if (!card) {
      return res.status(404).json({ message: 'Card not found' });
    }

    const oldSectionId = card.sectionId;
    const oldOrder = card.order;

    if (oldSectionId.toString() === newSectionId) {
      // Moving within the same section
      if (newOrder > oldOrder) {
        await Card.updateMany(
          { 
            sectionId: oldSectionId,
            order: { $gt: oldOrder, $lte: newOrder }
          },
          { $inc: { order: -1 } }
        );
      } else {
        await Card.updateMany(
          { 
            sectionId: oldSectionId,
            order: { $gte: newOrder, $lt: oldOrder }
          },
          { $inc: { order: 1 } }
        );
      }
    } else {
      // Moving to different section
      await Card.updateMany(
        { sectionId: oldSectionId, order: { $gt: oldOrder } },
        { $inc: { order: -1 } }
      );
      
      await Card.updateMany(
        { sectionId: newSectionId, order: { $gte: newOrder } },
        { $inc: { order: 1 } }
      );
    }

    card.sectionId = newSectionId;
    card.order = newOrder;
    await card.save();
    
    const populatedCard = await card.populate('assignedTo', 'name email');
    res.json(populatedCard);
  } catch (error) {
    res.status(500).json({ message: 'Error moving card' });
  }
});

export default router;