const mongoose = require("mongoose");

/**
 * INTEREST MODEL - Admin-defined career interests/domains
 * Used in: StudentProfile.interests, Role recommendations
 */
const interestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: String,
    relatedRoles: [{ type: mongoose.Schema.Types.ObjectId, ref: "Role" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Interest", interestSchema);
