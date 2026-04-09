const Recommendation = require("../models/Recommendation");
const Role = require("../models/Role");
const StudentProfile = require("../models/StudentProfile");
const Skill = require("../models/Skill");
const Interest = require("../models/Interest");
const scoringService = require("../services/aiRecommendationService");
const config = require("../config/recommendationConfig");

let legacyRecommendationIndexChecked = false;

async function ensureLegacyRecommendationIndexRemoved() {
  if (legacyRecommendationIndexChecked) return;

  const legacyIndexName = "userId_1_roleRecommended_1";

  try {
    const indexes = await Recommendation.collection.indexes();
    const hasLegacyIndex = indexes.some((idx) => idx.name === legacyIndexName);

    if (hasLegacyIndex) {
      await Recommendation.collection.dropIndex(legacyIndexName);
      console.log(`Dropped legacy recommendation index: ${legacyIndexName}`);
    }
  } catch (error) {
    // Non-fatal: recommendation insert may still work if index is absent or cannot be read yet.
    console.warn("Legacy index cleanup skipped:", error?.message || error);
  } finally {
    legacyRecommendationIndexChecked = true;
  }
}

/**
 * IMPROVED ALGORITHM: Calculate weighted match score with CGPA awareness
 * Scoring components:
 * - Skills match (highest weight - 40%)
 * - Interests match (25%)
 * - CGPA eligibility (20%)
 * - Project count (15%)
 * 
 * CGPA LOGIC:
 * - If CGPA >= minCGPA: eligible, full credit
 * - If CGPA < minCGPA: still calculate score, mark as needs-improvement
 */

function extractId(item) {
  if (!item && item !== 0) return null;
  if (typeof item === "string") return item;
  if (typeof item === "number") return String(item);
  if (item._id) return item._id.toString();
  try {
    return item.toString();
  } catch (e) {
    return null;
  }
}

function extractName(item) {
  if (!item) return null;
  if (typeof item === "string") return item;
  if (item.name) return item.name;
  return extractId(item);
}

/**
 * Calculate match score for a student against a role
 */
function calculateMatchScore(student, role) {
  // 1. CGPA SCORE (20% weight)
  const minCGPA = typeof role.minCGPA === "number" ? role.minCGPA : 0;
  const cgpaValue = typeof student.cgpa === "number" ? student.cgpa : 0;
  
  const cgpaScore = minCGPA > 0
    ? cgpaValue >= minCGPA
      ? (cgpaValue / 10) * 100
      : (cgpaValue / minCGPA) * 100
    : (cgpaValue / 10) * 100;

  // 2. SKILL MATCH SCORE (40% weight)
  const requiredSkills = Array.isArray(role.requiredSkills) ? role.requiredSkills : [];
  const studentSkills = Array.isArray(student.skills) ? student.skills : [];

  const requiredSkillIds = requiredSkills.map((s) => extractId(s)).filter(Boolean);
  const requiredSkillNames = requiredSkills.map((s) => extractName(s));
  const studentSkillIds = studentSkills.map((s) => extractId(s)).filter(Boolean);
  const studentSkillNames = studentSkills.map((s) => extractName(s));

  const matchedRequiredSkills = requiredSkillIds.filter((skillId) =>
    studentSkillIds.includes(skillId)
  );
  
  // Also match by name for fuzzy matching
  const matchedByName = requiredSkillNames.filter((name) =>
    studentSkillNames.some((sn) => sn && sn.toLowerCase() === name?.toLowerCase())
  );

  const totalMatched = new Set([...matchedRequiredSkills, ...matchedByName]).size;
  const skillMatchScore = requiredSkillIds.length > 0
    ? (totalMatched / requiredSkillIds.length) * 100
    : 100;

  // 3. INTEREST MATCH SCORE (25% weight)
  const relatedInterests = Array.isArray(role.relatedInterests) ? role.relatedInterests : [];
  const studentInterests = Array.isArray(student.interests) ? student.interests : [];

  const relatedInterestIds = relatedInterests.map((i) => extractId(i)).filter(Boolean);
  const relatedInterestNames = relatedInterests.map((i) => extractName(i));
  const studentInterestIds = studentInterests.map((i) => extractId(i)).filter(Boolean);
  const studentInterestNames = studentInterests.map((i) => extractName(i));

  const matchedInterests = relatedInterestIds.filter((interestId) =>
    studentInterestIds.includes(interestId)
  );

  const matchedInterestsByName = relatedInterestNames.filter((name) =>
    studentInterestNames.some((sn) => sn && sn.toLowerCase() === name?.toLowerCase())
  );

  const totalMatchedInterests = new Set([...matchedInterests, ...matchedInterestsByName]).size;
  const interestMatchScore = relatedInterestIds.length > 0
    ? (totalMatchedInterests / relatedInterestIds.length) * 100
    : 50;

  // 4. PROJECT RELEVANCE SCORE (15% weight)
  const totalProjects = Array.isArray(student.projectsDone)
    ? student.projectsDone.reduce((sum, proj) => sum + (Number(proj?.count) || 0), 0)
    : 0;
  const hasProjectData = Array.isArray(student.projectsDone) && student.projectsDone.length > 0;
  const minProjects = typeof role.minProjects === "number" ? role.minProjects : 0;
  const projectScore = minProjects > 0
    ? Math.min((totalProjects / minProjects) * 100, 100)
    : 100;

  // Apply weights (use role-specific or default from config)
  const roleWeights = role.weights || config.defaultWeights;
  const normalizedWeights = {
    cgpa: Number(roleWeights.cgpa) || 0,
    skillMatch: Number(roleWeights.skillMatch) || 0,
    interestMatch: Number(roleWeights.interestMatch) || 0,
    projectRelevance: Number(roleWeights.projectRelevance) || 0,
  };

  // If projects are not collected in profile, ignore project contribution and re-normalize.
  if (!hasProjectData) {
    normalizedWeights.projectRelevance = 0;
  }

  const totalWeight =
    normalizedWeights.cgpa +
    normalizedWeights.skillMatch +
    normalizedWeights.interestMatch +
    normalizedWeights.projectRelevance;

  const safeWeight = totalWeight > 0 ? totalWeight : 100;

  const matchPercentage = Math.max(0, Math.min(100, Math.round(
    (cgpaScore * normalizedWeights.cgpa) / safeWeight +
    (skillMatchScore * normalizedWeights.skillMatch) / safeWeight +
    (interestMatchScore * normalizedWeights.interestMatch) / safeWeight +
    (projectScore * normalizedWeights.projectRelevance) / safeWeight
  )));

  // Identify missing skills
  const missingSkillIds = requiredSkillIds.filter((skillId) => !studentSkillIds.includes(skillId));
  const missingSkillNames = missingSkillIds.map((id) => {
    const idx = requiredSkillIds.indexOf(id);
    return requiredSkillNames[idx] || id;
  });

  // Determine eligibility status
  const isEligibleCGPA = cgpaValue >= minCGPA;
  const totalProj = Array.isArray(student.projectsDone)
    ? student.projectsDone.reduce((sum, p) => sum + (Number(p?.count) || 0), 0)
    : 0;
  const isEligibleProjects = totalProj >= minProjects;
  
  const cgpaGapNeeded = isEligibleCGPA ? 0 : minCGPA - cgpaValue;

  return {
    matchPercentage,
    breakdown: {
      cgpaScore: Math.round(cgpaScore),
      skillMatchScore: Math.round(skillMatchScore),
      interestMatchScore: Math.round(interestMatchScore),
      projectRelevanceScore: Math.round(projectScore),
    },
    missingSkillNames,
    matchedInterestIds: matchedInterests,
    eligibilityStatus: isEligibleCGPA && isEligibleProjects ? "eligible" : "needs-improvement",
    cgpaGapNeeded: Math.round(cgpaGapNeeded * 10) / 10,
    totalProjects,
  };
}

/**
 * Calculate score for a specific track within a role
 * Used to select the best track for the student
 */
function calculateTrackMatch(student, track) {
  if (!track) return 0;

  const studentSkills = Array.isArray(student.skills) ? student.skills : [];
  const studentSkillNames = studentSkills.map((s) => extractName(s));
  const studentInterests = Array.isArray(student.interests) ? student.interests : [];
  const studentInterestNames = studentInterests.map((i) => extractName(i));

  // Track skill match
  const trackSkills = Array.isArray(track.requiredSkills) ? track.requiredSkills : [];
  const matchedTrackSkills = trackSkills.filter((skill) =>
    studentSkillNames.some((sn) => sn && sn.toLowerCase() === skill?.toLowerCase())
  );
  const trackSkillScore = trackSkills.length > 0
    ? (matchedTrackSkills.length / trackSkills.length) * 100
    : 50;

  // Track interest match
  const trackInterests = Array.isArray(track.relatedInterests) ? track.relatedInterests : [];
  const matchedTrackInterests = trackInterests.filter((interest) =>
    studentInterestNames.some((in_) => in_ && in_.toLowerCase() === interest?.toLowerCase())
  );
  const trackInterestScore = trackInterests.length > 0
    ? (matchedTrackInterests.length / trackInterests.length) * 100
    : 50;

  // Weighted combination (60% skills, 40% interests for track selection)
  return (trackSkillScore * 0.6) + (trackInterestScore * 0.4);
}

/**
 * Select best track for a role based on student profile
 */
function selectBestTrack(student, role) {
  if (!Array.isArray(role.tracks) || role.tracks.length === 0) {
    return { trackIndex: 0, trackName: null };
  }

  if (role.tracks.length === 1) {
    return { trackIndex: 0, trackName: role.tracks[0].trackName || null };
  }

  let bestTrackIndex = 0;
  let bestScore = -1;

  role.tracks.forEach((track, idx) => {
    const score = calculateTrackMatch(student, track);
    if (score > bestScore) {
      bestScore = score;
      bestTrackIndex = idx;
    }
  });

  return {
    trackIndex: bestTrackIndex,
    trackName: role.tracks[bestTrackIndex]?.trackName || null,
  };
}

/**
 * Generate improvement suggestions for low-CGPA students
 */
function generateImprovementSuggestions(student, role) {
  const suggestions = [];
  const cgpaGap = role.minCGPA - student.cgpa;

  if (cgpaGap > 0) {
    suggestions.push({
      type: "cgpa",
      message: `Improve your CGPA by ${cgpaGap.toFixed(1)} points to become fully eligible.`,
      target: role.minCGPA,
      current: student.cgpa,
    });
  }

  // Check project requirements
  const totalProjects = Array.isArray(student.projectsDone)
    ? student.projectsDone.reduce((sum, p) => sum + (p.count || 0), 0)
    : 0;
  
  if (totalProjects < role.minProjects) {
    suggestions.push({
      type: "projects",
      message: `Complete ${role.minProjects - totalProjects} more project(s) to become fully eligible.`,
      target: role.minProjects,
      current: totalProjects,
    });
  }

  // Suggest beginner topics to focus on
  if (Array.isArray(role.tracks) && role.tracks.length > 0) {
    const firstTrack = role.tracks[0];
    if (firstTrack.levels?.beginner?.topics && firstTrack.levels.beginner.topics.length > 0) {
      const topicNames = firstTrack.levels.beginner.topics
        .slice(0, 3)
        .map((t) => t.name || t)
        .filter(Boolean);
      
      if (topicNames.length > 0) {
        suggestions.push({
          type: "beginnerTopics",
          message: `Start with beginner level: ${topicNames.join(", ")}`,
          topics: topicNames,
        });
      }
    }
  }

  return suggestions;
}

/**
 * Generate recommendations for a student using deterministic weighted scoring
 * Returns top 2 recommendations ranked by match percentage
 * POST /api/recommend
 */
exports.generateRecommendations = async (req, res) => {
  try {
    const userId = req.user.id;

    const student = await StudentProfile.findOne({ userId })
      .populate("skills", "name category")
      .populate("interests", "name description");

    if (!student) {
      return res.status(400).json({
        message: "Please complete your profile before getting recommendations",
      });
    }

    // Backward compatibility: older records may have profileComplete=false even with valid data.
    if (!student.profileComplete) {
      student.profileComplete = true;
      await student.save();
    }

    if (student.selectedRole?.roleId && !student.selectedRole?.finalAssessmentPassed) {
      return res.status(409).json({
        message: "You already selected a career path. Complete and pass final assessment before generating recommendations for another role.",
      });
    }

    const roles = await Role.find()
      .populate("requiredSkills", "_id name")
      .populate("preferredSkills", "_id name")
      .populate("relatedInterests", "_id name");

    const qualifiedRoleIds = new Set(
      (student.qualifiedRoles || [])
        .map((entry) => String(entry?.roleId || ""))
        .filter(Boolean)
    );
    if (student.selectedRole?.roleId && student.selectedRole?.finalAssessmentPassed) {
      qualifiedRoleIds.add(String(student.selectedRole.roleId));
    }

    // Only consider faculty-configured roles with at least one required skill.
    const rolesWithData = roles.filter(
      (role) => (
        Array.isArray(role.requiredSkills) &&
        role.requiredSkills.length > 0 &&
        !qualifiedRoleIds.has(String(role._id))
      )
    );

    if (!rolesWithData.length) {
      return res.status(404).json({
        message: qualifiedRoleIds.size > 0
          ? "No new career paths available. You already qualified the configured roles."
          : "No career paths configured by faculty",
      });
    }

    const roleScores = rolesWithData.map((role) => {
      try {
        const baseScore = calculateMatchScore(student, role);

        let trackIndex = 0;
        let trackName = null;
        let adjustedMatch = baseScore.matchPercentage;

        // Prefer role tracks when configured.
        if (Array.isArray(role.tracks) && role.tracks.length > 0) {
          const bestTrack = selectBestTrack(student, role);
          if (bestTrack) {
            trackIndex = bestTrack.trackIndex;
            trackName = bestTrack.trackName;
          }
        }
        if (!Number.isFinite(adjustedMatch)) {
          adjustedMatch = 0;
        }

        const improvementSuggestions = baseScore.eligibilityStatus === "needs-improvement"
          ? generateImprovementSuggestions(student, role)
          : [];

        return {
          roleId: role._id,
          roleName: role.roleName,
          trackIndex,
          trackName,
          matchPercentage: adjustedMatch,
          breakdown: baseScore.breakdown,
          missingSkillNames: baseScore.missingSkillNames,
          eligibilityStatus: baseScore.eligibilityStatus,
          cgpaGapNeeded: baseScore.cgpaGapNeeded,
          improvementSuggestions,
        };
      } catch (roleError) {
        console.warn("Skipping invalid role during recommendation:", role?.roleName, roleError?.message);
        return null;
      }
    }).filter(Boolean);

    if (!roleScores.length) {
      return res.status(404).json({
        message: "No valid career paths available for recommendation. Please ask faculty to review role configuration.",
      });
    }

    // Sort career paths by weighted score.
    const sortedRoles = roleScores.sort((a, b) => {
      if (b.matchPercentage !== a.matchPercentage) {
        return b.matchPercentage - a.matchPercentage;
      }
      return String(a.roleName || "").localeCompare(String(b.roleName || ""));
    });

    // Step 6: Return Top 2 recommendations
    const topRecommendations = sortedRoles.slice(0, 2).map((rs, index) => {
      const explanation = scoringService.generateXAIExplanation(
        rs.matchPercentage,
        {
          skillMatchScore: rs.breakdown.skillMatchScore || 0,
          interestMatchScore: rs.breakdown.interestMatchScore || 0,
          cgpaScore: rs.breakdown.cgpaScore || 0,
          projectRelevanceScore: rs.breakdown.projectRelevanceScore || 0,
        }
      );

      return {
        userId,
        roleId: rs.roleId,
        roleName: rs.roleName,
        trackIndex: rs.trackIndex,
        trackName: rs.trackName,
        matchPercentage: rs.matchPercentage,
        breakdown: rs.breakdown,
        missingSkills: rs.missingSkillNames,
        eligibilityStatus: rs.eligibilityStatus,
        cgpaGapNeeded: rs.cgpaGapNeeded,
        improvementSuggestions: rs.improvementSuggestions,
        explanation,
        rank: index + 1,
        selected: false,
        accepted: false,
        acceptedAt: null,
        rejected: false,
        rejectedAt: null,
        recommendedTrack: null,
      };
    });

    // Keep accepted history immutable; refresh only non-accepted recommendations.
    await ensureLegacyRecommendationIndexRemoved();
    await Recommendation.deleteMany({ userId, accepted: { $ne: true } });
    const savedRecommendations = await Recommendation.insertMany(topRecommendations);

    res.status(201).json({
      message: "Recommendations generated successfully",
      count: savedRecommendations.length,
      recommendations: savedRecommendations,
    });
  } catch (error) {
    console.error("Recommendation generation error:", error);

    if (error?.name === "CastError") {
      return res.status(400).json({
        message:
          "Recommendation data is misconfigured (invalid skill/interest/role references). Ask faculty/admin to review career path data.",
      });
    }

    if (error?.name === "ValidationError") {
      return res.status(400).json({
        message:
          "Recommendation data failed validation. Ask faculty/admin to review role configuration.",
      });
    }

    const includeDetails = process.env.NODE_ENV !== "production";
    const baseMessage = "Failed to generate recommendations.";
    return res.status(500).json({
      message: includeDetails && error?.message
        ? `${baseMessage} ${error.message}`
        : baseMessage,
    });
  }
};

/**
 * Fetch student's recommendations (sorted by rank)
 * GET /api/recommend
 */
exports.getRecommendations = async (req, res) => {
  try {
    const userId = req.user.id;

    const recommendations = await Recommendation.find({ userId })
      .populate("roleId", "roleName minCGPA minProjects description")
      .sort({ rank: 1 });

    // Remove stale recommendations that no longer point to an existing role.
    const validRecommendations = recommendations.filter((rec) => rec.roleId);
    const staleRecommendations = recommendations.filter((rec) => !rec.roleId);

    if (staleRecommendations.length > 0) {
      await Recommendation.deleteMany({
        _id: { $in: staleRecommendations.map((rec) => rec._id) },
      });
    }

    if (!validRecommendations.length) {
      return res.status(404).json({
        message: "No recommendations found. Generate recommendations first.",
      });
    }

    res.json({
      count: validRecommendations.length,
      recommendations: validRecommendations,
    });
  } catch (error) {
    console.error("Fetch recommendations error:", error);
    res.status(500).json({ message: "Failed to fetch recommendations" });
  }
};

/**
 * Student selects a recommended role
 * PUT /api/recommend/:recommendationId/select
 */
exports.selectRole = async (req, res) => {
  try {
    const userId = req.user.id;
    const { recommendationId } = req.params;

    const student = await StudentProfile.findOne({ userId });
    if (!student) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const recommendation = await Recommendation.findOne({
      _id: recommendationId,
      userId,
    });

    if (!recommendation) {
      return res.status(404).json({
        message: "Recommendation not found or does not belong to you",
      });
    }

    if (student.selectedRole?.roleId && !student.selectedRole?.finalAssessmentPassed) {
      if (String(student.selectedRole.roleId) === String(recommendation.roleId)) {
        return res.status(200).json({
          message: "Role already selected. Continue with assessments for this path.",
          recommendation,
          selectedRole: student.selectedRole,
        });
      }

      return res.status(409).json({
        message: "You already selected a role. Complete and pass final assessment before choosing another path.",
      });
    }

    if (recommendation.rejected) {
      return res.status(400).json({
        message: "This recommendation was rejected. Generate recommendations again to get fresh options.",
      });
    }

    if (
      student.selectedRole?.roleId &&
      student.selectedRole?.finalAssessmentPassed &&
      String(student.selectedRole.roleId) === String(recommendation.roleId)
    ) {
      return res.status(400).json({
        message: "This role is already your qualified path. Choose another recommendation.",
      });
    }

    await Recommendation.updateMany({ userId }, { $set: { selected: false, selectedAt: null } });

    recommendation.selected = true;
    recommendation.selectedAt = new Date();
    recommendation.accepted = true;
    recommendation.acceptedAt = new Date();
    recommendation.rejected = false;
    recommendation.rejectedAt = null;
    await recommendation.save();

    student.selectedRole = {
      roleId: recommendation.roleId,
      trackIndex: recommendation.trackIndex || 0,
      trackName: recommendation.trackName || null,
      lockedAt: new Date(),
      canChange: true,
      finalAssessmentPassed: false,
      qualifiedAt: null,
      qualifiedBy: null,
      qualificationAssessmentId: null,
    };
    await student.save();

    res.json({
      message: "Role selected successfully",
      recommendation,
      selectedRole: student.selectedRole,
    });
  } catch (error) {
    console.error("Select role error:", error);
    res.status(500).json({ message: "Failed to select role" });
  }
};

/**
 * Student rejects a recommendation
 * PUT /api/recommend/:recommendationId/reject
 */
exports.rejectRecommendation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { recommendationId } = req.params;

    const recommendation = await Recommendation.findOne({
      _id: recommendationId,
      userId,
    });

    if (!recommendation) {
      return res.status(404).json({
        message: "Recommendation not found or does not belong to you",
      });
    }

    if (recommendation.accepted || recommendation.selected) {
      return res.status(400).json({
        message: "Accepted recommendation cannot be rejected or deleted.",
      });
    }

    if (recommendation.rejected) {
      return res.status(200).json({
        message: "Recommendation already rejected",
        recommendation,
      });
    }

    recommendation.rejected = true;
    recommendation.rejectedAt = new Date();
    recommendation.selected = false;
    recommendation.selectedAt = null;
    await recommendation.save();

    return res.json({
      message: "Recommendation rejected",
      recommendation,
    });
  } catch (error) {
    console.error("Reject recommendation error:", error);
    return res.status(500).json({ message: "Failed to reject recommendation" });
  }
};

/**
 * Get rule-based readiness analysis for selected role
 * GET /api/recommend/readiness
 */
exports.getReadinessAnalysis = async (req, res) => {
  try {
    const userId = req.user.id;

    const student = await StudentProfile.findOne({ userId })
      .populate("skills", "name")
      .populate("selectedRole.roleId");

    if (!student || !student.selectedRole?.roleId) {
      return res.status(404).json({
        message: "No role selected. Please select a recommendation first.",
      });
    }

    const role = await Role.findById(student.selectedRole.roleId)
      .populate("requiredSkills", "name");

    if (!role) {
      return res.status(404).json({ message: "Selected role not found" });
    }

    // Fetch student's assessment history
    const Assessment = require("../models/Assessment");
    const assessments = await Assessment.find({ 
      studentId: userId,
      status: 'completed'
    });

    // Calculate rule-based readiness metrics
    const skillConfidence = scoringService.calculateSkillConfidence(
      student,
      assessments,
      role.requiredSkills
    );

    const readinessIndex = scoringService.calculateReadinessIndex(
      student,
      role,
      assessments
    );

    const improvementPlan = scoringService.generateImprovementPlan(
      student,
      role,
      skillConfidence
    );

    res.json({
      readinessIndex,
      skillConfidence,
      improvementPlan,
      role: {
        name: role.roleName,
        minCGPA: role.minCGPA,
        minProjects: role.minProjects,
      },
      student: {
        cgpa: student.cgpa,
        totalProjects: (student.projectsDone || []).reduce((sum, p) => sum + p.count, 0),
        skillCount: student.skills.length,
      },
    });
  } catch (error) {
    console.error("Readiness analysis error:", error);
    res.status(500).json({ message: "Failed to generate readiness analysis" });
  }
};

/**
 * Get rule-based readiness analysis for any student (Faculty only)
 * GET /api/recommend/readiness/:userId
 */
exports.getReadinessByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const student = await StudentProfile.findOne({ userId })
      .populate("skills", "name")
      .populate("selectedRole.roleId");

    if (!student || !student.selectedRole?.roleId) {
      return res.status(404).json({
        message: "Student has not selected a role yet.",
      });
    }

    const role = await Role.findById(student.selectedRole.roleId)
      .populate("requiredSkills", "name");

    if (!role) {
      return res.status(404).json({ message: "Selected role not found" });
    }

    // Fetch student's assessment history
    const Assessment = require("../models/Assessment");
    const assessments = await Assessment.find({ 
      studentId: userId,
      status: 'completed'
    });

    // Calculate rule-based readiness metrics
    const skillConfidence = scoringService.calculateSkillConfidence(
      student,
      assessments,
      role.requiredSkills
    );

    const readinessIndex = scoringService.calculateReadinessIndex(
      student,
      role,
      assessments
    );

    const improvementPlan = scoringService.generateImprovementPlan(
      student,
      role,
      skillConfidence
    );

    res.json({
      readinessIndex,
      skillConfidence,
      improvementPlan,
      role: {
        name: role.roleName,
        minCGPA: role.minCGPA,
        minProjects: role.minProjects,
      },
      student: {
        cgpa: student.cgpa,
        totalProjects: (student.projectsDone || []).reduce((sum, p) => sum + p.count, 0),
        skillCount: student.skills.length,
      },
    });
  } catch (error) {
    console.error("Readiness analysis error:", error);
    res.status(500).json({ message: "Failed to generate readiness analysis" });
  }
};