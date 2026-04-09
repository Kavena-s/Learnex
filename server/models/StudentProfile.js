const mongoose = require("mongoose");

/**
 * STUDENT PROFILE MODEL
 * Stores student academic and career information
 */
const studentProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    
    // Academic Info
    email: String,
    name: String,
    department: String,
    cgpa: { type: Number, min: 0, max: 10 }, // Only stored once
    
    // Career Info
    preferredDomain: String, // e.g., "Web Development", "Data Science"
    skills: [{ type: mongoose.Schema.Types.ObjectId, ref: "Skill" }],
    interests: [{ type: mongoose.Schema.Types.ObjectId, ref: "Interest" }],
    
    // Project Info
    projectsDone: [
      {
        domain: String, // e.g., "Web Development", "AI/ML"
        count: Number,
      },
    ],

    // Selected Role (locked after selection)
    selectedRole: {
      roleId: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
      trackIndex: { type: Number, default: 0 }, // Index of selected track within role
      trackName: String, // Denormalized for quick access
      lockedAt: Date,
      canChange: { type: Boolean, default: false }, // Controlled by admin
      finalAssessmentPassed: { type: Boolean, default: false },
      qualifiedAt: Date,
      qualifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      qualificationAssessmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Assessment" },
    },

    // Persist all role-level final qualifications for profile display/history.
    qualifiedRoles: [
      {
        roleId: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
        roleName: String,
        trackName: String,
        qualifiedAt: { type: Date, default: Date.now },
        qualifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        sourceAssessmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Assessment" },
      },
    ],

    // Roadmap Progress (track-aware)
    roadmapProgress: {
      beginner: {
        completedTopics: [String],
        progressPercentage: { type: Number, default: 0 },
        completed: { type: Boolean, default: false },
        completedAt: Date,
      },
      intermediate: {
        completedTopics: [String],
        progressPercentage: { type: Number, default: 0 },
        completed: { type: Boolean, default: false },
        completedAt: Date,
      },
      advanced: {
        completedTopics: [String],
        progressPercentage: { type: Number, default: 0 },
        completed: { type: Boolean, default: false },
        completedAt: Date,
      },
    },

    // Admin-certified skill qualifications based on assessment outcomes
    qualifiedSkills: [
      {
        skillName: String,
        level: { type: String, enum: ["beginner", "intermediate", "advanced"] },
        score: Number,
        qualifiedAt: { type: Date, default: Date.now },
        qualifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        sourceAssessmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Assessment" },
      },
    ],

    profileComplete: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StudentProfile", studentProfileSchema);
