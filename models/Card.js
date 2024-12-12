import mongoose from 'mongoose';

const cardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  sectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    required: true
  },
  boardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Board',
    required: true
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  dueDate: Date,
  order: {
    type: Number,
    default: 0
  },
  labels: [{
    name: String,
    color: String
  }]
}, { timestamps: true });

export default mongoose.model('Card', cardSchema);