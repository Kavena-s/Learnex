const mongoose = require("mongoose");

const questionTopicSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    skillName: { type: String, required: true, trim: true, index: true },
    difficultyLevel: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      required: true,
      index: true,
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

questionTopicSchema.index({ name: 1, skillName: 1, difficultyLevel: 1 }, { unique: true });

module.exports = mongoose.model("QuestionTopic", questionTopicSchema);
