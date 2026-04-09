/**
 * ANALYTICS SERVICE
 * Aggregate metrics for admin dashboard insights
 */

const Recommendation = require("../models/Recommendation");
const StudentProfile = require("../models/StudentProfile");
const Assessment = require("../models/Assessment");
const Role = require("../models/Role");
const User = require("../models/User");
const QuestionBank = require("../models/QuestionBank");
require("../models/Skill");
require("../models/Interest");

/**
 * Get domain/role popularity metrics
 * @returns {Array} Most recommended roles with counts
 */
async function getDomainPopularity() {
  try {
    let recommendations = await Recommendation.aggregate([
      {
        $match: { $or: [{ selected: true }, { isSelected: true }] },
      },
      {
        $lookup: {
          from: "roles",
          localField: "roleId",
          foreignField: "_id",
          as: "role",
        },
      },
      {
        $unwind: "$role",
      },
      {
        $group: {
          _id: { $ifNull: ["$role.domain", "Unspecified"] },
          count: { $sum: 1 },
          roles: {
            $push: {
              roleName: "$role.roleName",
              roleId: "$roleId",
            },
          },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    // Also get role-level breakdown
    let rolePopularity = await Recommendation.aggregate([
      {
        $match: { $or: [{ selected: true }, { isSelected: true }] },
      },
      {
        $group: {
          _id: "$roleId",
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "roles",
          localField: "_id",
          foreignField: "_id",
          as: "role",
        },
      },
      {
        $unwind: "$role",
      },
      {
        $project: {
          _id: 1,
          count: 1,
          roleName: "$role.roleName",
          domain: { $ifNull: ["$role.domain", "Unspecified"] },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 10,
      },
    ]);

    // Fallback: if selected recommendation flags are missing, use selected roles from profiles.
    if (!rolePopularity.length) {
      rolePopularity = await StudentProfile.aggregate([
        {
          $match: {
            "selectedRole.roleId": { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: "$selectedRole.roleId",
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "roles",
            localField: "_id",
            foreignField: "_id",
            as: "role",
          },
        },
        { $unwind: "$role" },
        {
          $project: {
            _id: 1,
            count: 1,
            roleName: "$role.roleName",
            domain: { $ifNull: ["$role.domain", "Unspecified"] },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]);

    }

    // Enrich legacy roles that don't have domain populated yet.
    const missingDomainRoleIds = rolePopularity
      .filter((r) => !r.domain || String(r.domain).trim().toLowerCase() === "unspecified")
      .map((r) => r._id)
      .filter(Boolean);

    if (missingDomainRoleIds.length > 0) {
      const legacyRoles = await Role.find({ _id: { $in: missingDomainRoleIds } })
        .populate("relatedInterests", "name")
        .select("_id domain relatedInterests")
        .lean();

      const legacyDomainByRoleId = new Map();
      legacyRoles.forEach((role) => {
        const explicitDomain = String(role?.domain || "").trim();
        const derivedDomain = String(role?.relatedInterests?.[0]?.name || "").trim();
        legacyDomainByRoleId.set(
          String(role._id),
          explicitDomain || derivedDomain || "Unspecified"
        );
      });

      rolePopularity = rolePopularity.map((roleStat) => ({
        ...roleStat,
        domain: legacyDomainByRoleId.get(String(roleStat._id)) || roleStat.domain || "Unspecified",
      }));
    }

    // Keep byDomain aligned with topRoles after normalization/enrichment.
    const domainMap = new Map();
    rolePopularity.forEach((r) => {
      const domainKey = String(r.domain || "Unspecified");
      if (!domainMap.has(domainKey)) {
        domainMap.set(domainKey, { _id: domainKey, count: 0, roles: [] });
      }
      const entry = domainMap.get(domainKey);
      entry.count += Number(r.count) || 0;
      entry.roles.push({ roleName: r.roleName, roleId: r._id });
    });
    recommendations = Array.from(domainMap.values()).sort((a, b) => b.count - a.count);

    return {
      byDomain: recommendations,
      topRoles: rolePopularity,
    };
  } catch (error) {
    console.error("Domain popularity error:", error);
    throw error;
  }
}

/**
 * Get skill gap trends
 * @returns {Object} Skills students are missing vs their selected roles
 */
async function getSkillGapTrends() {
  try {
    let recommendations = await Recommendation.find({
      $or: [{ selected: true }, { isSelected: true }]
    }).populate({
      path: "roleId",
      select: "requiredSkills",
      populate: { path: "requiredSkills", select: "name" },
    });

    // Fallback: if recommendation selection flags are unavailable, use selected roles in profiles.
    if (!recommendations.length) {
      const selectedProfiles = await StudentProfile.find({
        "selectedRole.roleId": { $exists: true, $ne: null },
      })
        .populate({
          path: "selectedRole.roleId",
          select: "requiredSkills",
          populate: { path: "requiredSkills", select: "name" },
        })
        .select("userId selectedRole")
        .lean();

      recommendations = selectedProfiles
        .map((profile) => ({
          userId: profile.userId,
          roleId: profile.selectedRole?.roleId,
        }))
        .filter((entry) => entry.roleId);
    }

    const userIds = recommendations
      .map((rec) => rec.userId || rec.studentId)
      .filter(Boolean);

    const profiles = await StudentProfile.find({ userId: { $in: userIds } })
      .populate("skills", "name")
      .select("userId skills")
      .lean();

    const profileByUserId = new Map(
      profiles.map((p) => [String(p.userId), p])
    );

    const gapAnalysis = {};
    let totalGaps = 0;

    recommendations.forEach((rec) => {
      if (!rec.roleId || !rec.roleId.requiredSkills || !rec.roleId.requiredSkills.length) return;

      const ownerId = String(rec.userId || rec.studentId || "");
      const studentProfile = profileByUserId.get(ownerId);
      const existingSkills = (studentProfile?.skills || [])
        .map((s) => String(s?.name || s?.skillName || "").trim().toLowerCase())
        .filter(Boolean);

      const requiredSkills = (rec.roleId.requiredSkills || [])
        .map((rs) => String(rs?.name || rs?.skillName || "").trim().toLowerCase())
        .filter(Boolean);

      if (!requiredSkills.length) return;

      const missingSkills = requiredSkills.filter(
        (rs) => !existingSkills.includes(rs)
      );

      missingSkills.forEach((skill) => {
        if (!gapAnalysis[skill]) {
          gapAnalysis[skill] = {
            skillName: skill,
            count: 0,
            affectedStudents: 0,
          };
        }
        gapAnalysis[skill].count++;
        totalGaps++;
      });

      if (missingSkills.length > 0) {
        missingSkills.forEach((skill) => {
          gapAnalysis[skill].affectedStudents++;
        });
      }
    });

    // Convert to array and sort
    const trends = Object.values(gapAnalysis).sort((a, b) => b.count - a.count);

    return {
      totalStudentsAnalyzed: recommendations.length,
      totalSkillGaps: totalGaps,
      averageGapsPerStudent: recommendations.length > 0 ? (totalGaps / recommendations.length).toFixed(2) : 0,
      topMissingSkills: trends.slice(0, 15),
    };
  } catch (error) {
    console.error("Skill gap trends error:", error);
    throw error;
  }
}

/**
 * Get average readiness index across all students
 * @returns {Object} Readiness metrics
 */
async function getReadinessMetrics() {
  try {
    let recommendations = await Recommendation.find({
      $or: [{ selected: true }, { isSelected: true }]
    });

    // Fallback: when selected flags are not set, use latest recommendation per student.
    if (!recommendations.length) {
      const latestByUser = await Recommendation.aggregate([
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: "$userId",
            rec: { $first: "$$ROOT" },
          },
        },
        { $replaceRoot: { newRoot: "$rec" } },
      ]);
      recommendations = latestByUser;
    }

    if (recommendations.length === 0) {
      return {
        totalStudents: 0,
        averageReadiness: 0,
        distribution: {
          excellent: 0,
          good: 0,
          moderate: 0,
          low: 0,
        },
      };
    }

    // Helper to safely extract readiness value (check both current and legacy field names)
    const getReadinessValue = (rec) => rec.matchPercentage || rec.readinessIndex || 0;

    const totalReadiness = recommendations.reduce(
      (sum, rec) => sum + getReadinessValue(rec),
      0
    );
    const averageReadiness = totalReadiness / recommendations.length;

    // Distribution (using the same helper)
    const distribution = {
      excellent: recommendations.filter((r) => getReadinessValue(r) >= 80).length,
      good: recommendations.filter(
        (r) => getReadinessValue(r) >= 60 && getReadinessValue(r) < 80
      ).length,
      moderate: recommendations.filter(
        (r) => getReadinessValue(r) >= 40 && getReadinessValue(r) < 60
      ).length,
      low: recommendations.filter((r) => getReadinessValue(r) < 40).length,
    };

    return {
      totalStudents: recommendations.length,
      averageReadiness: Math.round(averageReadiness),
      distribution,
    };
  } catch (error) {
    console.error("Readiness metrics error:", error);
    throw error;
  }
}

/**
 * Get assessment pass/fail ratios
 * @returns {Object} Assessment performance metrics
 */
async function getAssessmentMetrics() {
  try {
    // Final assessment performance only (faculty-scheduled outcome metrics).
    const finalAssessments = await Assessment.find({
      type: "faculty-scheduled",
      skillName: { $regex: "^final assessment$", $options: "i" },
      status: { $in: ["completed", "reviewed"] },
    });

    const passedCount = finalAssessments.filter((a) => a.result === "passed").length;
    const failedCount = finalAssessments.filter((a) => a.result === "needs_improvement").length;
    const scoredFinalAssessments = finalAssessments.filter((a) => typeof a.score === "number");

    const metrics = {
      totalAttempts: finalAssessments.length,
      passed: passedCount,
      failed: failedCount,
      averageScore: 0,
      passRate: 0,
      byLevel: {
        beginner: { total: 0, passed: 0, averageScore: 0 },
        intermediate: { total: 0, passed: 0, averageScore: 0 },
        advanced: { total: 0, passed: 0, averageScore: 0 },
      },
      bySkill: {},
    };

    if (finalAssessments.length > 0) {
      if (scoredFinalAssessments.length > 0) {
        const totalScore = scoredFinalAssessments.reduce((sum, a) => sum + a.score, 0);
        metrics.averageScore = Math.round(totalScore / scoredFinalAssessments.length);
      }
      metrics.passRate = Math.round((metrics.passed / metrics.totalAttempts) * 100);

      // By level
      ["beginner", "intermediate", "advanced"].forEach((level) => {
        const levelAssessments = finalAssessments.filter((a) => a.level === level);
        if (levelAssessments.length > 0) {
          metrics.byLevel[level].total = levelAssessments.length;
          metrics.byLevel[level].passed = levelAssessments.filter(
            (a) => a.result === "passed"
          ).length;
          const levelWithScore = levelAssessments.filter((a) => typeof a.score === "number");
          if (levelWithScore.length > 0) {
            const levelTotal = levelWithScore.reduce((sum, a) => sum + a.score, 0);
            metrics.byLevel[level].averageScore = Math.round(
              levelTotal / levelWithScore.length
            );
          }
        }
      });

      // By skill
      finalAssessments.forEach((a) => {
        if (!metrics.bySkill[a.skillName]) {
          metrics.bySkill[a.skillName] = {
            total: 0,
            passed: 0,
            averageScore: 0,
          };
        }
        metrics.bySkill[a.skillName].total++;
        if (a.result === "passed") {
          metrics.bySkill[a.skillName].passed++;
        }
      });

      // Calculate average per skill
      Object.keys(metrics.bySkill).forEach((skill) => {
        const skillAssessments = finalAssessments.filter((a) => a.skillName === skill);
        const skillWithScore = skillAssessments.filter((a) => typeof a.score === "number");
        if (skillWithScore.length > 0) {
          const skillTotal = skillWithScore.reduce((sum, a) => sum + a.score, 0);
          metrics.bySkill[skill].averageScore = Math.round(
            skillTotal / skillWithScore.length
          );
        }
      });
    }

    return metrics;
  } catch (error) {
    console.error("Assessment metrics error:", error);
    throw error;
  }
}

/**
 * Get student engagement metrics
 * @returns {Object} Engagement statistics
 */
async function getEngagementMetrics() {
  try {
    const totalStudents = await User.countDocuments({ role: "student" });
    const studentsWithProfiles = await StudentProfile.countDocuments();
    
    // Handle both userId and studentId field names in Recommendation collection
    const recommendationUserIds = await Recommendation.distinct("userId");
    const recommendationStudentIds = await Recommendation.distinct("studentId");
    const studentsWithRecommendations = new Set([...recommendationUserIds, ...recommendationStudentIds]).size;
    
    const studentsWithSelectedRole = await StudentProfile.countDocuments({
      "selectedRole.roleId": { $exists: true, $ne: null },
    });
    
    // Handle both userId and studentId field names in Assessment collection
    const assessmentUserIds = await Assessment.distinct("userId");
    const assessmentStudentIds = await Assessment.distinct("studentId");
    const studentsWithAssessments = new Set([...assessmentUserIds, ...assessmentStudentIds]).size;

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentProfiles = await StudentProfile.countDocuments({
      updatedAt: { $gte: thirtyDaysAgo },
    });

    const recentAssessments = await Assessment.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Safe rate calculation helper
    const safeRate = (part, total) => total > 0 ? Math.round((part / total) * 100) : 0;

    return {
      totalStudents,
      studentsWithProfiles,
      studentsWithRecommendations,
      studentsWithSelectedRole,
      studentsWithAssessments,
      profileCompletionRate: safeRate(studentsWithProfiles, totalStudents),
      roleSelectionRate: safeRate(studentsWithSelectedRole, studentsWithProfiles),
      assessmentParticipationRate: safeRate(studentsWithAssessments, studentsWithProfiles),
      recentActivity: {
        profileUpdates: recentProfiles,
        assessmentAttempts: recentAssessments,
      },
    };
  } catch (error) {
    console.error("Engagement metrics error:", error);
    throw error;
  }
}

/**
 * Get top-level dashboard stats consumed by AdminDashboard page
 * @returns {Object} Dashboard summary data
 */
async function getDashboardSummary() {
  const [
    totalStudents,
    totalQuestions,
    totalRoles,
    activeAssessments,
    recentStudents,
    pendingAssessmentsRaw,
  ] = await Promise.all([
    User.countDocuments({ role: "student" }),
    QuestionBank.countDocuments({ status: "approved" }),
    Role.countDocuments(),
    Assessment.countDocuments({ status: "active" }),
    User.find({ role: "student" })
      .select("name email createdAt")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    Assessment.find({ status: "requested" })
      .select("studentId skillName level requestedAt createdAt")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const pendingAssessments = [];
  if (pendingAssessmentsRaw.length > 0) {
    const studentIds = pendingAssessmentsRaw.map((a) => a.studentId).filter(Boolean);
    const students = await User.find({ _id: { $in: studentIds } })
      .select("name")
      .lean();
    const nameById = new Map(students.map((s) => [String(s._id), s.name || "Student"]));

    pendingAssessmentsRaw.forEach((assessment) => {
      pendingAssessments.push({
        ...assessment,
        studentName: nameById.get(String(assessment.studentId)) || "Student",
      });
    });
  }

  return {
    totalStudents,
    totalQuestions,
    totalRoles,
    activeAssessments,
    recentStudents,
    pendingAssessments,
  };
}

/**
 * Get comprehensive analytics dashboard data
 * @returns {Object} Complete analytics object
 */
async function getComprehensiveAnalytics() {
  try {
    const [
      domainPopularity,
      skillGaps,
      readiness,
      assessments,
      engagement,
      dashboard,
    ] = await Promise.all([
      getDomainPopularity(),
      getSkillGapTrends(),
      getReadinessMetrics(),
      getAssessmentMetrics(),
      getEngagementMetrics(),
      getDashboardSummary(),
    ]);

    return {
      generatedAt: new Date(),
      ...dashboard,
      domainPopularity,
      skillGaps,
      readiness,
      assessments,
      engagement,
    };
  } catch (error) {
    console.error("Comprehensive analytics error:", error);
    throw error;
  }
}

module.exports = {
  getDomainPopularity,
  getSkillGapTrends,
  getReadinessMetrics,
  getAssessmentMetrics,
  getEngagementMetrics,
  getDashboardSummary,
  getComprehensiveAnalytics,
};
