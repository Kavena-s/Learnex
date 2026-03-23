/**
 * AI RECOMMENDATION SERVICE
 * Modular AI-style scoring, confidence calculation, and readiness analysis
 */

const config = require('../config/recommendationConfig');

/**
 * Calculate skill confidence score for a student
 * Combines profile match + assessment performance
 * @param {Object} student - Student profile
 * @param {Array} assessments - Student's assessment history
 * @param {Array} requiredSkills - Skills needed for role
 * @returns {Object} Confidence scores per skill
 */
function calculateSkillConfidence(student, assessments = [], requiredSkills = []) {
  const confidenceScores = {};
  const studentSkillIds = (student.skills || []).map(s => s._id?.toString() || s.toString());

  requiredSkills.forEach(skill => {
    const skillId = skill._id?.toString() || skill.toString();
    const skillName = skill.name || skill;
    const normalizedSkillName = String(skillName).trim().toLowerCase();

    // Base confidence: do they have the skill?
    const hasSkill = studentSkillIds.includes(skillId);
    let baseConfidence = hasSkill ? 70 : 20;

    // Assessment boost (supports both legacy skillId and current skillName assessments)
    const skillAssessments = assessments.filter((assessment) => {
      const bySkillId = assessment.skillId?.toString() === skillId;
      const bySkillName =
        typeof assessment.skillName === "string" &&
        assessment.skillName.trim().toLowerCase() === normalizedSkillName;

      return (bySkillId || bySkillName) && assessment.status === "completed";
    });

    let assessmentBoost = 0;
    if (skillAssessments.length >= config.skillConfidence.minAssessments) {
      // Average score from recent assessments
      const avgScore = skillAssessments.reduce((sum, a) => sum + (a.score || 0), 0) / skillAssessments.length;
      assessmentBoost = avgScore * 0.3;  // Max 30% boost from assessments
    }

    const totalConfidence = Math.min(100, Math.round(baseConfidence + assessmentBoost));

    confidenceScores[skillName] = {
      score: totalConfidence,
      level: totalConfidence >= 80 ? 'high' : totalConfidence >= 50 ? 'medium' : 'low',
      hasSkill,
      assessmentCount: skillAssessments.length,
    };
  });

  return confidenceScores;
}

/**
 * Calculate overall readiness index (0-100)
 * Considers CGPA, skills, projects, and assessments
 * @param {Object} student - Student profile
 * @param {Object} role - Target role
 * @param {Array} assessments - Assessment history
 * @returns {Object} Readiness analysis
 */
function calculateReadinessIndex(student, role, assessments = []) {
  const weights = config.readinessWeights;

  // 1. CGPA Readiness (25%)
  const cgpaReadiness = role.minCGPA > 0
    ? Math.min(100, (student.cgpa / role.minCGPA) * 100)
    : (student.cgpa / 10) * 100;

  // 2. Skill Readiness (35%)
  const requiredSkillIds = (role.requiredSkills || []).map(s => s._id?.toString() || s.toString());
  const studentSkillIds = (student.skills || []).map(s => s._id?.toString() || s.toString());
  const matchedSkills = requiredSkillIds.filter(id => studentSkillIds.includes(id));
  const skillReadiness = requiredSkillIds.length > 0
    ? (matchedSkills.length / requiredSkillIds.length) * 100
    : 100;

  // 3. Project Readiness (20%)
  const totalProjects = (student.projectsDone || []).reduce((sum, p) => sum + (p.count || 0), 0);
  const projectReadiness = role.minProjects > 0
    ? Math.min(100, (totalProjects / role.minProjects) * 100)
    : 100;

  // 4. Assessment Readiness (20%)
  const completedAssessments = assessments.filter(a => a.status === 'completed');
  const avgAssessmentScore = completedAssessments.length > 0
    ? completedAssessments.reduce((sum, a) => sum + (a.score || 0), 0) / completedAssessments.length
    : 0;

  // Weighted combination
  const readinessIndex = Math.round(
    (cgpaReadiness * weights.cgpaContribution) / 100 +
    (skillReadiness * weights.skillMatchContribution) / 100 +
    (projectReadiness * weights.projectContribution) / 100 +
    (avgAssessmentScore * weights.assessmentContribution) / 100
  );

  return {
    overall: Math.min(100, readinessIndex),
    breakdown: {
      cgpa: Math.round(cgpaReadiness),
      skills: Math.round(skillReadiness),
      projects: Math.round(projectReadiness),
      assessments: Math.round(avgAssessmentScore),
    },
    level: readinessIndex >= 80 ? 'ready' : readinessIndex >= 50 ? 'developing' : 'building',
    assessmentCount: completedAssessments.length,
  };
}

/**
 * Generate enhanced XAI explanation
 * @param {number} matchPercentage - Overall match score
 * @param {Object} breakdown - Score breakdown
 * @returns {string} Human-readable explanation
 */
function generateXAIExplanation(matchPercentage, breakdown) {
  const { skillMatchScore, interestMatchScore, cgpaScore, projectRelevanceScore } = breakdown;

  let template;
  if (matchPercentage >= 75) {
    template = config.explanationTemplates.excellent;
  } else if (matchPercentage >= 50) {
    template = config.explanationTemplates.good;
  } else if (matchPercentage >= 30) {
    template = config.explanationTemplates.moderate;
  } else {
    template = config.explanationTemplates.needsWork;
  }

  return template
    .replace('{matchPercentage}', matchPercentage)
    .replace('{skillMatchScore}', skillMatchScore)
    .replace('{interestMatchScore}', interestMatchScore)
    .replace('{cgpaScore}', cgpaScore)
    .replace('{projectRelevanceScore}', projectRelevanceScore);
}

/**
 * Analyze weak areas and suggest improvements
 * @param {Object} student - Student profile
 * @param {Object} role - Target role
 * @param {Object} confidenceScores - Skill confidence map
 * @returns {Array} Prioritized improvement actions
 */
function generateImprovementPlan(student, role, confidenceScores) {
  const actions = [];

  // CGPA improvement
  if (student.cgpa < role.minCGPA) {
    const gap = role.minCGPA - student.cgpa;
    actions.push({
      priority: 'high',
      category: 'academic',
      action: `Improve CGPA by ${gap.toFixed(1)} points`,
      impact: `+${Math.round((gap / role.minCGPA) * 20)}% readiness`,
    });
  }

  // Low-confidence skills
  Object.entries(confidenceScores).forEach(([skill, data]) => {
    if (data.level === 'low') {
      actions.push({
        priority: data.hasSkill ? 'medium' : 'high',
        category: 'skill',
        action: `${data.hasSkill ? 'Master' : 'Learn'} ${skill}`,
        impact: `+${data.hasSkill ? '15' : '25'}% readiness`,
      });
    }
  });

  // Project gap
  const totalProjects = (student.projectsDone || []).reduce((sum, p) => sum + (p.count || 0), 0);
  if (totalProjects < role.minProjects) {
    actions.push({
      priority: 'medium',
      category: 'project',
      action: `Complete ${role.minProjects - totalProjects} more project(s)`,
      impact: `+${Math.round(((role.minProjects - totalProjects) / role.minProjects) * 20)}% readiness`,
    });
  }

  // Sort by priority
  const priorityOrder = { high: 1, medium: 2, low: 3 };
  return actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

module.exports = {
  calculateSkillConfidence,
  calculateReadinessIndex,
  generateXAIExplanation,
  generateImprovementPlan,
  config,
};
