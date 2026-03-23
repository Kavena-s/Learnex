const mongoose = require("mongoose");

/**
 * SKILL MODEL - Admin-defined skills available for students to select
 * Used in: StudentProfile.skills, Role.requiredSkills
 */
const skillSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    category: String, // e.g., "Frontend", "Backend", "Database"
    description: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Skill", skillSchema);
