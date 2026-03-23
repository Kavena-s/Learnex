const mongoose = require("mongoose");

const facultyActivitySchema = new mongoose.Schema(
  {
    facultyEmail: String,
    action: String, // CREATED / UPDATED / DELETED
    entity: String, // Recommendation / RoleCriteria / User
    entityId: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("FacultyActivity", facultyActivitySchema);
