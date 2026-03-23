const mongoose = require("mongoose");

/**
 * QUESTION BANK MODEL
 * Stores approved questions for assessments (Hybrid: 60% stored + 40% AI-generated)
 */
const questionBankSchema = new mongoose.Schema(
  {
    skillName: { type: String, required: true, index: true },
    skillId: { type: mongoose.Schema.Types.ObjectId, ref: "Skill" },
    topicId: { type: mongoose.Schema.Types.ObjectId, ref: "QuestionTopic", index: true },
    topicName: { type: String, index: true },
    
    difficultyLevel: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      required: true,
      index: true
    },
    
    questionText: { type: String, required: true },
    
    options: {
      type: [String],
      validate: {
        validator: function(v) {
          return v.length >= 2 && v.length <= 6;
        },
        message: "Must have between 2 and 6 options"
      }
    },
    
    correctAnswer: {
      type: Number,
      required: true,
      min: 0
    },
    
    concept: { type: String, required: true }, // e.g., "Closures", "Promises", "HTTP Methods"
    
    // Question metadata
    source: {
      type: String,
      enum: ["ai_generated", "manual", "imported"],
      default: "manual"
    },
    
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "archived"],
      default: "pending",
      index: true
    },
    
    // Usage tracking
    timesUsed: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 }, // Average % of students who got it right
    lastUsed: Date,
    
    // Admin metadata
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    
    rejectionReason: String,
    
    // Tags for better organization
    tags: [String],
    
    // Quality indicators
    difficulty_rating: { type: Number, min: 1, max: 5 }, // Admin-rated difficulty
    quality_score: { type: Number, min: 1, max: 5 }, // Admin-rated quality
    
  },
  { timestamps: true }
);

// Indexes for efficient querying
questionBankSchema.index({ skillName: 1, difficultyLevel: 1, status: 1 });
questionBankSchema.index({ topicId: 1, status: 1 });
questionBankSchema.index({ status: 1, createdAt: -1 });
questionBankSchema.index({ concept: 1 });

// Virtual for usage percentage
questionBankSchema.virtual('usageRate').get(function() {
  if (this.timesUsed === 0) return 0;
  return this.averageScore;
});

module.exports = mongoose.model("QuestionBank", questionBankSchema);
