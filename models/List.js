import mongoose from "mongoose";

const listSchema = new mongoose.Schema({
  name: { type: String, required: true },
  boardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Board",
    required: true,
  },
  position: { type: Number, required: true }, // For ordering
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("List", listSchema);
