// controllers/roleController.js
const Role = require("../models/Role");
const Skill = require("../models/Skill");
const Interest = require("../models/Interest");
const Domain = require("../models/Domain");

/**
 * Create a new role (faculty only)
 * POST /api/faculty/roles
 * Body: {
 *   roleName,
 *   description,
 *   minCGPA,
 *   minProjects,
 *   requiredSkills: [skillId, ...],
 *   preferredSkills: [skillId, ...],
 *   relatedInterests: [interestId, ...],
 *   weights: { cgpa, skillMatch, interestMatch, projectRelevance },
 *   roadmap: { beginner, intermediate, advanced }
 * }
 */
exports.createRole = async (req, res) => {
  try {
    const {
      roleName,
      domain,
      description,
      minCGPA,
      minProjects,
      requiredSkills,
      preferredSkills,
      relatedInterests,
      weights,
      roadmap,
    } = req.body;

    // Validate required fields
    if (!roleName || !domain || minCGPA === undefined || minProjects === undefined) {
      return res.status(400).json({
        message: "roleName, domain, minCGPA, and minProjects are required",
      });
    }

    const normalizedDomain = String(domain || "").trim();
    const existingDomain = await Domain.findOne({ name: normalizedDomain });
    if (!existingDomain) {
      return res.status(400).json({ message: "Invalid domain. Please select a configured domain." });
    }

    // Validate CGPA range
    if (minCGPA < 0 || minCGPA > 10) {
      return res
        .status(400)
        .json({ message: "minCGPA must be between 0 and 10" });
    }

    // Validate roadmap has 3 levels
    if (
      !roadmap ||
      !roadmap.beginner ||
      !roadmap.intermediate ||
      !roadmap.advanced
    ) {
      return res.status(400).json({
        message: "roadmap must contain beginner, intermediate, and advanced levels",
      });
    }

    // Validate skills and interests exist
    if (requiredSkills && requiredSkills.length > 0) {
      const skills = await Skill.find({ _id: { $in: requiredSkills } });
      if (skills.length !== requiredSkills.length) {
        return res.status(400).json({ message: "Invalid skill IDs" });
      }
    }

    if (relatedInterests && relatedInterests.length > 0) {
      const interests = await Interest.find({
        _id: { $in: relatedInterests },
      });
      if (interests.length !== relatedInterests.length) {
        return res.status(400).json({ message: "Invalid interest IDs" });
      }
    }

    // Create role
    const role = await Role.create({
      roleName,
      domain: normalizedDomain,
      description: description || "",
      minCGPA,
      minProjects,
      requiredSkills: requiredSkills || [],
      preferredSkills: preferredSkills || [],
      relatedInterests: relatedInterests || [],
      weights: weights || {
        cgpa: 20,
        skillMatch: 40,
        interestMatch: 25,
        projectRelevance: 15,
      },
      roadmap,
      createdBy: req.user.id,
    });

    // Populate relationships for response
    await role.populate("requiredSkills", "name category");
    await role.populate("preferredSkills", "name category");
    await role.populate("relatedInterests", "name description");

    res.status(201).json({
      message: "Role created successfully",
      role,
    });
  } catch (error) {
    console.error("Create role error:", error);
    res.status(500).json({ message: "Failed to create role" });
  }
};

/**
 * Get all roles
 * GET /api/faculty/roles
 */
exports.getRoles = async (req, res) => {
  try {
    const roles = await Role.find()
      .populate("requiredSkills", "name category")
      .populate("preferredSkills", "name category")
      .populate("relatedInterests", "name description")
      .sort({ roleName: 1 });

    res.json({
      count: roles.length,
      roles,
    });
  } catch (error) {
    console.error("Fetch roles error:", error);
    res.status(500).json({ message: "Failed to fetch roles" });
  }
};

/**
 * Get a single role with full details
 * GET /api/faculty/roles/:roleId
 */
exports.getRole = async (req, res) => {
  try {
    const { roleId } = req.params;

    const role = await Role.findById(roleId)
      .populate("requiredSkills", "name category description")
      .populate("preferredSkills", "name category description")
      .populate("relatedInterests", "name description");

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    res.json(role);
  } catch (error) {
    console.error("Fetch role error:", error);
    res.status(500).json({ message: "Failed to fetch role" });
  }
};

/**
 * Get role roadmap for student view
 * GET /api/roles/:roleId/roadmap
 */
exports.getRoleRoadmap = async (req, res) => {
  try {
    const { roleId } = req.params;

    const role = await Role.findById(roleId)
      .populate("requiredSkills", "name category")
      .populate("preferredSkills", "name category")
      .populate("relatedInterests", "name");

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    // Return roadmap with skills and interests info
    res.json({
      roleName: role.roleName,
      description: role.description,
      minCGPA: role.minCGPA,
      minProjects: role.minProjects,
      requiredSkills: role.requiredSkills,
      relatedInterests: role.relatedInterests,
      roadmap: role.roadmap,
    });
  } catch (error) {
    console.error("Fetch roadmap error:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch roadmap" });
  }
};

/**
 * Update role (faculty only)
 * PUT /api/faculty/roles/:roleId
 * Body: Partial update possible for all fields
 */
exports.updateRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    const updates = req.body;

    // Validate CGPA range if being updated
    if (updates.minCGPA !== undefined) {
      if (updates.minCGPA < 0 || updates.minCGPA > 10) {
        return res
          .status(400)
          .json({ message: "minCGPA must be between 0 and 10" });
      }
    }

    // Validate skills if being updated
    if (updates.requiredSkills && updates.requiredSkills.length > 0) {
      const skills = await Skill.find({ _id: { $in: updates.requiredSkills } });
      if (skills.length !== updates.requiredSkills.length) {
        return res.status(400).json({ message: "Invalid skill IDs" });
      }
    }

    if (updates.domain !== undefined) {
      const normalizedDomain = String(updates.domain || "").trim();
      if (!normalizedDomain) {
        return res.status(400).json({ message: "domain cannot be empty" });
      }
      const existingDomain = await Domain.findOne({ name: normalizedDomain });
      if (!existingDomain) {
        return res.status(400).json({ message: "Invalid domain. Please select a configured domain." });
      }
      updates.domain = normalizedDomain;
    }

    // Validate interests if being updated
    if (updates.relatedInterests && updates.relatedInterests.length > 0) {
      const interests = await Interest.find({
        _id: { $in: updates.relatedInterests },
      });
      if (interests.length !== updates.relatedInterests.length) {
        return res.status(400).json({ message: "Invalid interest IDs" });
      }
    }

    const role = await Role.findByIdAndUpdate(roleId, updates, {
      new: true,
      runValidators: true,
    })
      .populate("requiredSkills", "name category")
      .populate("preferredSkills", "name category")
      .populate("relatedInterests", "name description");

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    res.json({
      message: "Role updated successfully",
      role,
    });
  } catch (error) {
    console.error("Update role error:", error);
    res.status(500).json({ message: "Failed to update role" });
  }
};

/**
 * Delete role (faculty only)
 * DELETE /api/faculty/roles/:roleId
 */
exports.deleteRole = async (req, res) => {
  try {
    const { roleId } = req.params;

    const role = await Role.findByIdAndDelete(roleId);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    res.json({
      message: "Role deleted successfully",
      role,
    });
  } catch (error) {
    console.error("Delete role error:", error);
    res.status(500).json({ message: "Failed to delete role" });
  }
};

/**
 * Save role (legacy endpoint for backward compatibility)
 * POST /api/faculty/roles
 */
exports.saveRole = async (req, res) => {
  return exports.createRole(req, res);
};