const Interest = require("../models/Interest");
const Role = require("../models/Role");

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findInterestByNameCaseInsensitive(name, excludeId = null) {
  const query = {
    name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return Interest.findOne(query);
}

/**
 * Create a new interest (faculty only)
 * POST /api/faculty/interests
 * Body: { name, description, relatedRoles }
 */
exports.createInterest = async (req, res) => {
  try {
    const { name, description, relatedRoles } = req.body;
    const facultyId = req.user.id;
    const normalizedName = String(name || "").trim();

    // Validate inputs
    if (!normalizedName) {
      return res.status(400).json({ message: "name is required" });
    }

    // Check if interest already exists
    const existingInterest = await findInterestByNameCaseInsensitive(normalizedName);
    if (existingInterest) {
      return res
        .status(400)
        .json({ message: "Interest with this name already exists" });
    }

    // Validate related roles if provided
    if (relatedRoles && Array.isArray(relatedRoles)) {
      const roles = await Role.find({ _id: { $in: relatedRoles } });
      if (roles.length !== relatedRoles.length) {
        return res.status(400).json({ message: "Invalid role IDs provided" });
      }
    }

    // Create interest
    const interest = await Interest.create({
      name: normalizedName,
      description: description || "",
      relatedRoles: relatedRoles || [],
      createdBy: facultyId,
    });

    res.status(201).json({
      message: "Interest created successfully",
      interest,
    });
  } catch (error) {
    console.error("Create interest error:", error);
    res.status(500).json({ message: "Failed to create interest" });
  }
};

/**
 * Get all interests
 * GET /api/faculty/interests
 */
exports.getAllInterests = async (req, res) => {
  try {
    const interests = await Interest.find()
      .populate("relatedRoles", "roleName")
      .populate("createdBy", "name email")
      .sort({ name: 1 });

    res.json({
      count: interests.length,
      interests,
    });
  } catch (error) {
    console.error("Fetch interests error:", error);
    res.status(500).json({ message: "Failed to fetch interests" });
  }
};

/**
 * Get interest by ID
 * GET /api/faculty/interests/:interestId
 */
exports.getInterest = async (req, res) => {
  try {
    const { interestId } = req.params;

    const interest = await Interest.findById(interestId)
      .populate("relatedRoles", "roleName")
      .populate("createdBy", "name email");

    if (!interest) {
      return res.status(404).json({ message: "Interest not found" });
    }

    res.json(interest);
  } catch (error) {
    console.error("Fetch interest error:", error);
    res.status(500).json({ message: "Failed to fetch interest" });
  }
};

/**
 * Update interest (faculty only)
 * PUT /api/faculty/interests/:interestId
 * Body: { name, description, relatedRoles }
 */
exports.updateInterest = async (req, res) => {
  try {
    const { interestId } = req.params;
    const { name, description, relatedRoles } = req.body;
    const normalizedName = typeof name === "string" ? name.trim() : "";

    const interest = await Interest.findById(interestId);
    if (!interest) {
      return res.status(404).json({ message: "Interest not found" });
    }

    // If name is being changed, check for duplicates
    if (normalizedName && normalizedName.toLowerCase() !== String(interest.name || "").toLowerCase()) {
      const existingInterest = await findInterestByNameCaseInsensitive(normalizedName, interest._id);
      if (existingInterest) {
        return res
          .status(400)
          .json({ message: "Interest with this name already exists" });
      }
      interest.name = normalizedName;
    }

    if (description !== undefined) interest.description = description;

    // Validate and update related roles
    if (relatedRoles && Array.isArray(relatedRoles)) {
      const roles = await Role.find({ _id: { $in: relatedRoles } });
      if (roles.length !== relatedRoles.length) {
        return res.status(400).json({ message: "Invalid role IDs provided" });
      }
      interest.relatedRoles = relatedRoles;
    }

    await interest.save();

    // Populate for response
    await interest.populate("relatedRoles", "roleName");
    await interest.populate("createdBy", "name email");

    res.json({
      message: "Interest updated successfully",
      interest,
    });
  } catch (error) {
    console.error("Update interest error:", error);
    res.status(500).json({ message: "Failed to update interest" });
  }
};

/**
 * Delete interest (faculty only)
 * DELETE /api/faculty/interests/:interestId
 */
exports.deleteInterest = async (req, res) => {
  try {
    const { interestId } = req.params;

    const interest = await Interest.findByIdAndDelete(interestId);
    if (!interest) {
      return res.status(404).json({ message: "Interest not found" });
    }

    res.json({
      message: "Interest deleted successfully",
      interest,
    });
  } catch (error) {
    console.error("Delete interest error:", error);
    res.status(500).json({ message: "Failed to delete interest" });
  }
};

/**
 * Bulk create interests from array
 * POST /api/faculty/interests/bulk
 * Body: { interests: [{ name, description, relatedRoles }, ...] }
 */
exports.bulkCreateInterests = async (req, res) => {
  try {
    const { interests } = req.body;
    const facultyId = req.user.id;

    if (!Array.isArray(interests) || interests.length === 0) {
      return res
        .status(400)
        .json({ message: "interests must be a non-empty array" });
    }

    const existing = await Interest.find({}, "name");
    const existingNamesLower = new Set(existing.map((i) => String(i.name || "").toLowerCase()));

    const newInterests = [];
    for (const item of interests) {
      const normalizedName = String(item?.name || "").trim();
      if (!normalizedName) continue;

      const lowerName = normalizedName.toLowerCase();
      if (existingNamesLower.has(lowerName)) continue;

      newInterests.push({
        name: normalizedName,
        description: item?.description || "",
        relatedRoles: item?.relatedRoles || [],
        createdBy: facultyId,
      });
      existingNamesLower.add(lowerName);
    }

    const created = newInterests.length ? await Interest.insertMany(newInterests) : [];

    res.status(201).json({
      message: `${created.length} interests created (${interests.length - created.length} skipped as duplicates)`,
      created,
    });
  } catch (error) {
    console.error("Bulk create interests error:", error);
    res.status(500).json({ message: "Failed to bulk create interests" });
  }
};
