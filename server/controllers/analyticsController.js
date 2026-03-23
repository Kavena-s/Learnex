/**
 * FACULTY ANALYTICS CONTROLLER
 * Endpoints for faculty dashboard insights and metrics
 */

const analyticsService = require("../services/analyticsService");

/**
 * Get all analytics data for faculty dashboard
 * GET /api/faculty/analytics
 */
exports.getAnalytics = async (req, res) => {
  try {
    const analytics = await analyticsService.getComprehensiveAnalytics();
    res.json(analytics);
  } catch (error) {
    console.error("Get analytics error:", error);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
};

/**
 * Get domain/role popularity metrics
 * GET /api/faculty/analytics/domains
 */
exports.getDomainPopularity = async (req, res) => {
  try {
    const data = await analyticsService.getDomainPopularity();
    res.json(data);
  } catch (error) {
    console.error("Get domain popularity error:", error);
    res.status(500).json({ message: "Failed to fetch domain popularity" });
  }
};

/**
 * Get skill gap trends
 * GET /api/faculty/analytics/skill-gaps
 */
exports.getSkillGaps = async (req, res) => {
  try {
    const data = await analyticsService.getSkillGapTrends();
    res.json(data);
  } catch (error) {
    console.error("Get skill gaps error:", error);
    res.status(500).json({ message: "Failed to fetch skill gap trends" });
  }
};

/**
 * Get readiness index metrics
 * GET /api/faculty/analytics/readiness
 */
exports.getReadinessMetrics = async (req, res) => {
  try {
    const data = await analyticsService.getReadinessMetrics();
    res.json(data);
  } catch (error) {
    console.error("Get readiness metrics error:", error);
    res.status(500).json({ message: "Failed to fetch readiness metrics" });
  }
};

/**
 * Get assessment performance metrics
 * GET /api/faculty/analytics/assessments
 */
exports.getAssessmentMetrics = async (req, res) => {
  try {
    const data = await analyticsService.getAssessmentMetrics();
    res.json(data);
  } catch (error) {
    console.error("Get assessment metrics error:", error);
    res.status(500).json({ message: "Failed to fetch assessment metrics" });
  }
};

/**
 * Get student engagement metrics
 * GET /api/faculty/analytics/engagement
 */
exports.getEngagementMetrics = async (req, res) => {
  try {
    const data = await analyticsService.getEngagementMetrics();
    res.json(data);
  } catch (error) {
    console.error("Get engagement metrics error:", error);
    res.status(500).json({ message: "Failed to fetch engagement metrics" });
  }
};
