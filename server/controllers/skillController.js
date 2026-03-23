const Skill = require("../models/Skill");

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findSkillByNameCaseInsensitive(name, excludeId = null) {
  const query = {
    name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return Skill.findOne(query);
}

/**
 * Create a new skill (faculty only)
 * POST /api/faculty/skills
 * Body: { name, category, description }
 */
exports.createSkill = async (req, res) => {
  try {
    const { name, category, description } = req.body;
    const facultyId = req.user.id;
    const normalizedName = String(name || "").trim();
    const normalizedCategory = String(category || "").trim();

    // Validate inputs
    if (!normalizedName || !normalizedCategory) {
      return res
        .status(400)
        .json({ message: "name and category are required" });
    }

    // Check if skill already exists
    const existingSkill = await findSkillByNameCaseInsensitive(normalizedName);
    if (existingSkill) {
      return res
        .status(400)
        .json({ message: "Skill with this name already exists" });
    }

    // Create skill
    const skill = await Skill.create({
      name: normalizedName,
      category: normalizedCategory,
      description: description || "",
      createdBy: facultyId,
    });

    res.status(201).json({
      message: "Skill created successfully",
      skill,
    });
  } catch (error) {
    console.error("Create skill error:", error);
    res.status(500).json({ message: "Failed to create skill" });
  }
};

/**
 * Get all skills
 * GET /api/faculty/skills
 */
exports.getAllSkills = async (req, res) => {
  try {
    const { category } = req.query;

    const filter = {};
    if (category) {
      filter.category = category;
    }

    const skills = await Skill.find(filter)
      .populate("createdBy", "name email")
      .sort({ category: 1, name: 1 });

    res.json({
      count: skills.length,
      skills,
    });
  } catch (error) {
    console.error("Fetch skills error:", error);
    res.status(500).json({ message: "Failed to fetch skills" });
  }
};

/**
 * Get skill categories (for filtering/selection)
 * GET /api/faculty/skills/categories
 */
exports.getSkillCategories = async (req, res) => {
  try {
    const categories = await Skill.distinct("category");
    res.json({
      categories: categories.sort(),
    });
  } catch (error) {
    console.error("Fetch categories error:", error);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
};

/**
 * Get skill by ID
 * GET /api/faculty/skills/:skillId
 */
exports.getSkill = async (req, res) => {
  try {
    const { skillId } = req.params;

    const skill = await Skill.findById(skillId).populate(
      "createdBy",
      "name email"
    );

    if (!skill) {
      return res.status(404).json({ message: "Skill not found" });
    }

    res.json(skill);
  } catch (error) {
    console.error("Fetch skill error:", error);
    res.status(500).json({ message: "Failed to fetch skill" });
  }
};

/**
 * Update skill (faculty only)
 * PUT /api/faculty/skills/:skillId
 * Body: { name, category, description }
 */
exports.updateSkill = async (req, res) => {
  try {
    const { skillId } = req.params;
    const { name, category, description } = req.body;
    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedCategory = typeof category === "string" ? category.trim() : "";

    const skill = await Skill.findById(skillId);
    if (!skill) {
      return res.status(404).json({ message: "Skill not found" });
    }

    // If name is being changed, check for duplicates
    if (normalizedName && normalizedName.toLowerCase() !== String(skill.name || "").toLowerCase()) {
      const existingSkill = await findSkillByNameCaseInsensitive(normalizedName, skill._id);
      if (existingSkill) {
        return res
          .status(400)
          .json({ message: "Skill with this name already exists" });
      }
      skill.name = normalizedName;
    }

    if (normalizedCategory) skill.category = normalizedCategory;
    if (description !== undefined) skill.description = description;

    await skill.save();

    res.json({
      message: "Skill updated successfully",
      skill,
    });
  } catch (error) {
    console.error("Update skill error:", error);
    res.status(500).json({ message: "Failed to update skill" });
  }
};

/**
 * Delete skill (faculty only)
 * DELETE /api/faculty/skills/:skillId
 */
exports.deleteSkill = async (req, res) => {
  try {
    const { skillId } = req.params;

    const skill = await Skill.findByIdAndDelete(skillId);
    if (!skill) {
      return res.status(404).json({ message: "Skill not found" });
    }

    res.json({
      message: "Skill deleted successfully",
      skill,
    });
  } catch (error) {
    console.error("Delete skill error:", error);
    res.status(500).json({ message: "Failed to delete skill" });
  }
};

/**
 * Bulk create skills from array
 * POST /api/faculty/skills/bulk
 * Body: { skills: [{ name, category, description }, ...] }
 */
exports.bulkCreateSkills = async (req, res) => {
  try {
    const { skills } = req.body;
    const facultyId = req.user.id;

    if (!Array.isArray(skills) || skills.length === 0) {
      return res
        .status(400)
        .json({ message: "skills must be a non-empty array" });
    }

    const existing = await Skill.find({}, "name");
    const existingNamesLower = new Set(existing.map((s) => String(s.name || "").toLowerCase()));

    const newSkills = [];
    for (const item of skills) {
      const normalizedName = String(item?.name || "").trim();
      if (!normalizedName) continue;

      const lowerName = normalizedName.toLowerCase();
      if (existingNamesLower.has(lowerName)) continue;

      newSkills.push({
        name: normalizedName,
        category: String(item?.category || "General").trim() || "General",
        description: item?.description || "",
        createdBy: facultyId,
      });
      existingNamesLower.add(lowerName);
    }

    const created = newSkills.length ? await Skill.insertMany(newSkills) : [];

    res.status(201).json({
      message: `${created.length} skills created (${skills.length - created.length} skipped as duplicates)`,
      created,
    });
  } catch (error) {
    console.error("Bulk create skills error:", error);
    res.status(500).json({ message: "Failed to bulk create skills" });
  }
};
