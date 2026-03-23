const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const profileController = require("../controllers/profileController");

/**
 * STUDENT PROFILE ROUTES
 */

// Save or update student profile
router.post("/", auth, profileController.saveProfile);

// Get student's profile
router.get("/", auth, profileController.getProfile);

// Get available skills for multi-select
router.get("/skills", auth, profileController.getAvailableSkills);

// Get available interests for multi-select
router.get("/interests", auth, profileController.getAvailableInterests);

// Get available domains for preferred domain dropdown
router.get("/domains", auth, profileController.getAvailableDomains);

// Get learning materials for missing skills
router.get("/learning-materials", auth, profileController.getLearningMaterials);

// Get all profiles (Faculty only - handled by middleware on the faculty route set)
router.get("/all", auth, profileController.getAllProfiles);

module.exports = router;
