const mongoose = require("mongoose");

/**
 * ROLE/CAREER PATH MODEL
 * Defines career roles, requirements, and learning roadmaps (with tracks)
 */

// Level schema with topics containing learning links
const levelSchema = new mongoose.Schema({
  topics: [
    {
      name: String,
      learnLinks: [String],
    },
  ],
  certificateLink: String,
  estimatedHours: Number,
}, { _id: false });

// Track schema - represents a specific learning path variant
const trackSchema = new mongoose.Schema({
  trackName: String,
  requiredSkills: [String], // Can be skill names or IDs
  relatedInterests: [String], // Can be interest names or IDs
  internships: [
    {
      company: String,
      link: String,
    },
  ],
  levels: {
    beginner: levelSchema,
    intermediate: levelSchema,
    advanced: levelSchema,
  },
}, { _id: false });

// Old roadmap level schema - for backward compatibility
const roadmapLevelSchema = new mongoose.Schema({
  topics: [String], 
  description: String,
  estimatedHours: Number,
});

const roleSchema = new mongoose.Schema(
  {
    roleName: { type: String, required: true, unique: true },
    description: String,
    
    // Eligibility
    minCGPA: { type: Number, default: 0 },
    minProjects: { type: Number, default: 0 },
    
    // Required & Preferred Skills (for backward compatibility)
    requiredSkills: [{ type: mongoose.Schema.Types.ObjectId, ref: "Skill" }],
    preferredSkills: [{ type: mongoose.Schema.Types.ObjectId, ref: "Skill" }],
    
    // Career domains (for backward compatibility)
    relatedInterests: [{ type: mongoose.Schema.Types.ObjectId, ref: "Interest" }],
    
    // Scoring weights (sum should be 100)
    weights: {
      cgpa: { type: Number, default: 20 },
      skillMatch: { type: Number, default: 40 },
      interestMatch: { type: Number, default: 25 },
      projectRelevance: { type: Number, default: 15 },
    },

    // NEW: Multiple learning tracks
    tracks: [trackSchema],

    // OLD: Single roadmap (backward compatibility)
    roadmap: {
      beginner: roadmapLevelSchema,
      intermediate: roadmapLevelSchema,
      advanced: roadmapLevelSchema,
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Role", roleSchema);