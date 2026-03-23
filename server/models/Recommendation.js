const mongoose = require("mongoose");

/**
 * RECOMMENDATION MODEL
 * Stores calculated career recommendations for students
 */
const recommendationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
    },

    roleName: {
      type: String,
      required: true,
      index: true,
    },
    
    // Track information (for roles with multiple tracks)
    trackIndex: {
      type: Number,
      default: 0,
    },
    trackName: {
      type: String,
    },

    // Match score & breakdown
    matchPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    breakdown: {
      cgpaScore: Number,
      skillMatchScore: Number,
      interestMatchScore: Number,
      projectRelevanceScore: Number,
    },

    // Analysis
    explanation: String,
    missingSkills: [String],

    // Extra info (safely stored for later UI)
    eligibilityStatus: String,
    cgpaGapNeeded: Number,
    improvementSuggestions: [mongoose.Schema.Types.Mixed],

    // Selection tracking
    selected: { type: Boolean, default: false },
    selectedAt: Date,
    rank: Number, // 1st, 2nd, 3rd recommendation

    createdAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Recommendation", recommendationSchema);
