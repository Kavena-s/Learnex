const express = require("express");
const router = express.Router();
const facultyMiddleware = require("../middleware/facultyMiddleware");
const auth = require("../middleware/authMiddleware");

// Import controllers
const skillController = require("../controllers/skillController");
const interestController = require("../controllers/interestController");
const domainController = require("../controllers/domainController");
const roleController = require("../controllers/roleController");
const assessmentController = require("../controllers/assessmentController");
const analyticsController = require("../controllers/analyticsController");
const questionBankController = require("../controllers/questionBankController");

/**
 * FACULTY MIDDLEWARE
 * All faculty routes require authentication + faculty role
 */
router.use(auth, facultyMiddleware);

/* ========== SKILLS MANAGEMENT ========== */
router.post("/skills", skillController.createSkill);
router.get("/skills", skillController.getAllSkills);
router.get("/skills/categories", skillController.getSkillCategories);
router.get("/skills/:skillId", skillController.getSkill);
router.put("/skills/:skillId", skillController.updateSkill);
router.delete("/skills/:skillId", skillController.deleteSkill);
router.post("/skills/bulk", skillController.bulkCreateSkills); // Bulk create

/* ========== INTERESTS MANAGEMENT ========== */
router.post("/interests", interestController.createInterest);
router.get("/interests", interestController.getAllInterests);
router.get("/interests/:interestId", interestController.getInterest);
router.put("/interests/:interestId", interestController.updateInterest);
router.delete("/interests/:interestId", interestController.deleteInterest);
router.post("/interests/bulk", interestController.bulkCreateInterests); // Bulk create

/* ========== DOMAINS MANAGEMENT ========== */
router.post("/domains", domainController.createDomain);
router.get("/domains", domainController.getAllDomains);
router.delete("/domains/:domainId", domainController.deleteDomain);

/* ========== ROLES MANAGEMENT ========== */
router.post("/roles", roleController.createRole);
router.get("/roles", roleController.getRoles);
router.get("/roles/:roleId", roleController.getRole);
router.put("/roles/:roleId", roleController.updateRole);
router.delete("/roles/:roleId", roleController.deleteRole);

/* ========== ASSESSMENTS MANAGEMENT ========== */
router.get("/assessments", assessmentController.getAssessmentRequests); // Get all with filter
router.post("/assessments/:assessmentId/schedule", assessmentController.scheduleAssessment); // Schedule
router.put("/assessments/:assessmentId/decline", assessmentController.declineAssessment); // Decline request
router.put("/assessments/:assessmentId/qualify-skill", assessmentController.qualifySkillFromAssessment); // Qualify skill
router.put("/assessments/:assessmentId/complete", assessmentController.completeAssessment); // Complete
router.get("/assessments/student/:studentId", assessmentController.getStudentAssessmentHistory); // Student history

/* ========== ANALYTICS DASHBOARD ========== */
router.get("/analytics", analyticsController.getAnalytics); // Comprehensive analytics
router.get("/analytics/domains", analyticsController.getDomainPopularity); // Domain popularity
router.get("/analytics/skill-gaps", analyticsController.getSkillGaps); // Skill gap trends
router.get("/analytics/readiness", analyticsController.getReadinessMetrics); // Readiness metrics
router.get("/analytics/assessments", analyticsController.getAssessmentMetrics); // Assessment metrics
router.get("/analytics/engagement", analyticsController.getEngagementMetrics); // Engagement metrics

/* ========== QUESTION BANK MANAGEMENT ========== */
router.get("/questions/stats", questionBankController.getQuestionStats); // Statistics
router.get("/questions/topics", questionBankController.getTopics); // Topic list
router.post("/questions/topics", questionBankController.createTopic); // Create topic
router.put("/questions/topics/:id", questionBankController.updateTopic); // Edit topic
router.delete("/questions/topics/:id", questionBankController.deleteTopic); // Delete topic
router.post("/questions/migrate-topics", questionBankController.migrateQuestionsToTopics); // Migrate legacy questions to topic structure
router.post("/questions/bulk-import", questionBankController.bulkImportQuestions); // Bulk import
router.post("/questions/by-topic", questionBankController.createQuestionsByTopic); // Add many questions to a topic
router.post("/questions/by-skill", questionBankController.createQuestionsBySkill); // Add many questions by skill and level
router.get("/questions", questionBankController.getQuestions); // Get all with filters
router.post("/questions", questionBankController.createQuestion); // Create manually
router.get("/questions/:id", questionBankController.getQuestion); // Get single
router.put("/questions/:id", questionBankController.updateQuestion); // Update
router.put("/questions/:id/approve", questionBankController.approveQuestion); // Approve
router.put("/questions/:id/reject", questionBankController.rejectQuestion); // Reject
router.delete("/questions/:id", questionBankController.deleteQuestion); // Delete

module.exports = router;