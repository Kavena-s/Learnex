const mongoose = require("mongoose");

/**
 * ENHANCED ASSESSMENT MODEL - Adaptive Assessments with Dynamic Questions
 * Supports: Dynamic question generation, adaptive difficulty, attempt tracking, integrity features
 */
const assessmentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    skillName: {
      type: String,
      required: true,
    },
    level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      required: true,
    },

    // Assessment type: self-paced or faculty-scheduled (legacy admin-scheduled supported)
    type: {
      type: String,
      enum: ["self-paced", "faculty-scheduled", "admin-scheduled"],
      default: "self-paced",
    },

    // For faculty-scheduled assessments
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
    },
    scheduledDate: Date,
    mode: { type: String, enum: ["online", "offline"] },

    // Status flow supports both legacy and adaptive flows
    status: {
      type: String,
      enum: ["requested", "scheduled", "active", "completed", "expired", "reviewed", "declined"],
      default: "active",
    },

    // Dynamic questions for this attempt
    questions: [
      {
        questionText: String,
        options: [String],
        correctAnswer: Number,
        concept: String,
        difficulty: String,
        generatedAt: Date,
      },
    ],

    // Student answers
    answers: [Number], // Indices of selected options

    // Integrity features
    startedAt: Date,
    submittedAt: Date,
    timeLimit: { type: Number, default: 1800 }, // 30 minutes in seconds
    isTimedOut: { type: Boolean, default: false },

    // Secure Exam Tracking
    warningsCount: {
      type: Number,
      default: 0
    },
    maxWarnings: {
      type: Number,
      default: 3
    },
    forcedSubmission: {
      type: Boolean,
      default: false
    },

    // Performance tracking
    score: Number,
    totalQuestions: Number,
    correctAnswers: Number,

    // Adaptive learning
    conceptPerformance: {
      type: Map,
      of: {
        total: Number,
        correct: Number,
      },
    },
    weakConcepts: [String],

    // Adaptive recommendation
    recommendation: {
      action: { type: String, enum: ["level-up", "continue", "revise"] },
      message: String,
      nextLevel: Boolean,
      requiresRevision: Boolean,
    },

    // Legacy fields for backward compatibility
    requestedAt: Date,
    completedAt: Date,
    remarks: String,
    declinedAt: Date,
    declineReason: String,
    result: { type: String, enum: ["passed", "needs_improvement"] },
    adminNotes: String,

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Index for preventing multiple active attempts per skill
assessmentSchema.index({ studentId: 1, skillName: 1, status: 1 });

// Index for finding student's assessment history
assessmentSchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.model("Assessment", assessmentSchema);
