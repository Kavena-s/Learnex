const express = require("express");
const router = express.Router();
const {
  generateRecommendations,
  getRecommendations,
  selectRole,
  getReadinessAnalysis,
  getReadinessByUserId,
} = require("../controllers/recommendationController");
const auth = require("../middleware/authMiddleware");

// Generate top-3 recommendations based on student profile
router.post("/", auth, generateRecommendations);

// Fetch student's recommendations (sorted by rank)
router.get("/", auth, getRecommendations);

// Get AI-powered readiness analysis
router.get("/readiness", auth, getReadinessAnalysis);

// Get AI-powered readiness analysis for any student (Faculty only)
router.get("/readiness/:userId", auth, getReadinessByUserId);

// Student selects a recommended role
router.put("/:recommendationId/select", auth, selectRole);

module.exports = router;