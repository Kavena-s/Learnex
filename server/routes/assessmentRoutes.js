const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const assessmentController = require("../controllers/assessmentController");

/**
 * STUDENT ASSESSMENT ROUTES
 */

// Legacy: Student requests an assessment
router.post("/", auth, assessmentController.requestAssessment);

// Legacy: Get student's own assessment history
router.get("/", auth, assessmentController.getMyAssessments);

/**
 * ADAPTIVE ASSESSMENT ROUTES
 */

// Request final assessment (faculty approval required)
router.post("/request-final", auth, assessmentController.requestFinalAssessment);

// Start a new adaptive assessment
router.post("/start", auth, assessmentController.startAdaptiveAssessment);

// Submit assessment answers
router.post("/:assessmentId/submit", auth, assessmentController.submitAssessment);

// Check for active assessment on a skill
router.get("/active/:skillName", auth, assessmentController.getActiveAssessment);

// Register tab-switch warning
router.post("/:assessmentId/warning", auth, assessmentController.registerTabSwitchWarning);

// Get assessment history with analytics (all skills)
router.get("/history", auth, assessmentController.getAssessmentHistory);

// Get per-skill level summary and final eligibility
router.get("/summary", auth, assessmentController.getAssessmentSummary);

// Get assessment history for specific skill
router.get("/history/:skillName", auth, assessmentController.getAssessmentHistory);

module.exports = router;
