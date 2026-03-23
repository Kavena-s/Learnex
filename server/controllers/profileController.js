const StudentProfile = require("../models/StudentProfile");
const User = require("../models/User");
const Skill = require("../models/Skill");
const Interest = require("../models/Interest");
const Domain = require("../models/Domain");
const learningMaterialsService = require("../services/learningMaterialsService");

/**
 * ============================================
 * PROFILE CONTROLLER
 * Handles student profile creation & updates
 * ============================================
 */

/**
 * Create or update student profile
 * POST /api/profile
 */
exports.saveProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, department, cgpa, preferredDomain, skills, interests, projectsDone } = req.body;

    // Validate CGPA (only when provided)
    if (cgpa !== undefined && (isNaN(cgpa) || cgpa < 0 || cgpa > 10)) {
      return res.status(400).json({ message: "CGPA must be between 0-10" });
    }

    if (projectsDone !== undefined) {
      if (!Array.isArray(projectsDone)) {
        return res.status(400).json({ message: "projectsDone must be an array" });
      }

      for (const project of projectsDone) {
        const domain = String(project?.domain || "").trim();
        const count = Number(project?.count);

        if (!domain) {
          return res.status(400).json({ message: "Each project entry must include a domain" });
        }

        if (!Number.isFinite(count) || count < 0) {
          return res.status(400).json({ message: "Project count must be a valid non-negative number" });
        }
      }
    }

    let profile = await StudentProfile.findOne({ userId });

    if (!profile) {
      // Create new profile
      const user = await User.findById(userId);
      profile = await StudentProfile.create({
        userId,
        email: user.email,
        name: name || user.name,
        department: department || user.department || "Not specified",
        cgpa,
        preferredDomain: preferredDomain || "",
        skills: skills || [],
        interests: interests || [],
        projectsDone: projectsDone || [],
        profileComplete: true,
      });
    } else {
      // Update existing profile
      if (name !== undefined) profile.name = name;
      if (department !== undefined) profile.department = department;
      if (cgpa !== undefined) profile.cgpa = cgpa;
      if (preferredDomain !== undefined) profile.preferredDomain = preferredDomain;
      // Allow empty arrays to clear previous selections: check for undefined only
      if (skills !== undefined) profile.skills = skills;
      if (interests !== undefined) profile.interests = interests;
      if (projectsDone !== undefined) profile.projectsDone = projectsDone;
      profile.profileComplete = true;
      await profile.save();
    }

    // whenever profile data changes we should invalidate past recommendations
    const Recommendation = require("../models/Recommendation");
    await Recommendation.deleteMany({ userId });

    res.status(200).json({
      message: "Profile saved successfully",
      profile,
    });
  } catch (error) {
    console.error("❌ Profile save error:", error);
    res.status(500).json({ message: "Failed to save profile" });
  }
};

/**
 * Get student profile
 * GET /api/profile
 */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await StudentProfile.findOne({ userId })
      .populate("skills", "name category")
      .populate("interests", "name")
      .populate("selectedRole.roleId", "roleName description");

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json(profile);
  } catch (error) {
    console.error("❌ Profile fetch error:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

/**
 * Get all available skills
 * GET /api/profile/skills
 */
exports.getAvailableSkills = async (req, res) => {
  try {
    const skills = await Skill.find().select("_id name category");
    res.json(skills);
  } catch (error) {
    console.error("❌ Skills fetch error:", error);
    res.status(500).json({ message: "Failed to fetch skills" });
  }
};

/**
 * Get all available interests
 * GET /api/profile/interests
 */
exports.getAvailableInterests = async (req, res) => {
  try {
    const interests = await Interest.find().select("_id name");
    res.json(interests);
  } catch (error) {
    console.error("❌ Interests fetch error:", error);
    res.status(500).json({ message: "Failed to fetch interests" });
  }
};

/**
 * Get all available domains
 * GET /api/profile/domains
 */
exports.getAvailableDomains = async (req, res) => {
  try {
    const domains = await Domain.find().select("_id name").sort({ name: 1 });
    res.json(domains);
  } catch (error) {
    console.error("❌ Domains fetch error:", error);
    res.status(500).json({ message: "Failed to fetch domains" });
  }
};

/**
 * Get learning materials for student's weak/missing skills
 * GET /api/profile/learning-materials
 */
exports.getLearningMaterials = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const profile = await StudentProfile.findOne({ userId })
      .populate("skills", "name")
      .populate("selectedRole.roleId");

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    if (!profile.selectedRole?.roleId) {
      return res.status(400).json({ 
        message: "No role selected. Select a recommendation first." 
      });
    }

    const Role = require("../models/Role");
    const role = await Role.findById(profile.selectedRole.roleId)
      .populate("requiredSkills", "name");

    if (!role) {
      return res.status(404).json({ message: "Selected role not found" });
    }

    // Find missing skills
    const studentSkillIds = (profile.skills || []).map(s => s._id?.toString());
    const requiredSkillIds = (role.requiredSkills || []).map(s => s._id?.toString());
    
    const missingSkills = role.requiredSkills.filter(
      skill => !studentSkillIds.includes(skill._id.toString())
    );

    // Generate learning materials
    const materials = learningMaterialsService.getMaterialsForSkills(
      missingSkills,
      'beginner'
    );

    res.json({
      message: "Learning materials generated successfully",
      role: role.roleName,
      missingSkillsCount: missingSkills.length,
      materials,
    });
  } catch (error) {
    console.error("❌ Learning materials error:", error);
    res.status(500).json({ message: "Failed to fetch learning materials" });
  }
};

/**
 * Get all student profiles (Faculty only)
 * GET /api/profile/all
 */
exports.getAllProfiles = async (req, res) => {
  try {
    const profiles = await StudentProfile.find()
      .populate("skills", "name category")
      .populate("interests", "name")
      .populate("selectedRole.roleId", "roleName")
      .sort({ createdAt: -1 });

    res.json(profiles);
  } catch (error) {
    console.error("❌ All profiles fetch error:", error);
    res.status(500).json({ message: "Failed to fetch profiles" });
  }
};
