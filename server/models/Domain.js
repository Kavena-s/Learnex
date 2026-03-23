const mongoose = require("mongoose");

/**
 * DOMAIN MODEL - Admin-defined preferred career domains
 */
const domainSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Domain", domainSchema);
