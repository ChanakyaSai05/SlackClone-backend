import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import Section from '../models/Section.js';
import Card from '../models/Card.js';

const router = express.Router();

router.use(authenticateToken);

// Get all sections for a board
router.get('/board/:boardId', async (req, res) => {
  try {
    const sections = await Section.find({ boardId: req.params.boardId })
      .sort('order');
    res.json(sections);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching sections' });
  }
});

// Create new section
router.post('/', async (req, res) => {
  try {
    const { name, boardId } = req.body;
    const lastSection = await Section.findOne({ boardId })
      .sort('-order');
    
    const section = new Section({
      name,
      boardId,
      order: lastSection ? lastSection.order + 1 : 0
    });
    
    await section.save();
    res.status(201).json(section);
  } catch (error) {
    res.status(500).json({ message: 'Error creating section' });
  }
});

// Update section order
router.patch('/:sectionId/order', async (req, res) => {
  try {
    const { newOrder } = req.body;
    const section = await Section.findById(req.params.sectionId);
    
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    const oldOrder = section.order;
    
    // Update orders of affected sections
    if (newOrder > oldOrder) {
      await Section.updateMany(
        { 
          boardId: section.boardId,
          order: { $gt: oldOrder, $lte: newOrder }
        },
        { $inc: { order: -1 } }
      );
    } else {
      await Section.updateMany(
        { 
          boardId: section.boardId,
          order: { $gte: newOrder, $lt: oldOrder }
        },
        { $inc: { order: 1 } }
      );
    }

    section.order = newOrder;
    await section.save();
    
    res.json(section);
  } catch (error) {
    res.status(500).json({ message: 'Error updating section order' });
  }
});
// //delete section
// router.delete('/:sectionId', async (req, res) => {
//   try {
//     const section = await Section.findById(req.params.sectionId);
//     console.log(section,"section",req.params.sectionId);
//     if (!section) {
//       return res.status(404).json({ message: 'Section not found' });
//     }
//     console.log("Cards to delete:", await Card.find({ sectionId: req.params.sectionId }));
//     await Card.deleteMany({ sectionId: req.params.sectionId });
//     await section.remove();

//     res.json(section);
//   } catch (error) {
//     res.status(500).json({ message: 'Error deleting section' });
//   }
// });
router.delete('/:sectionId', async (req, res) => {
  try {
    const section = await Section.findById(req.params.sectionId);
    // console.log(section, "section", req.params.sectionId);

    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    const cardsToDelete = await Card.find({ sectionId: req.params.sectionId });
    // console.log("Cards to delete:", cardsToDelete);

    await Card.deleteMany({ sectionId: req.params.sectionId });
    await Section.deleteOne({ _id: req.params.sectionId }); // Correct method

    res.json(section);
  } catch (error) {
    console.error("Error deleting section:", error); // Add this line
    res.status(500).json({ message: 'Error deleting section', error: error.message }); // Add error details
  }
});


export default router;