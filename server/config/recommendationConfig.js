/**
 * RECOMMENDATION ENGINE CONFIGURATION
 * AI-style scoring weights and thresholds
 */

module.exports = {
  // Default scoring weights (can be overridden per role)
  defaultWeights: {
    cgpa: 20,
    skillMatch: 40,
    interestMatch: 25,
    projectRelevance: 15,
  },

  // Readiness index calculation weights
  readinessWeights: {
    cgpaContribution: 25,
    skillMatchContribution: 35,
    projectContribution: 20,
    assessmentContribution: 20,
  },

  // Skill confidence scoring
  skillConfidence: {
    // Base confidence from profile match
    baseMatchWeight: 0.5,
    // Assessment performance weight
    assessmentWeight: 0.5,
    // Minimum assessments to consider for confidence
    minAssessments: 1,
  },

  // Assessment adaptive rules
  adaptiveRules: {
    excellentThreshold: 80,  // ≥80% → level up
    passThreshold: 50,        // 50-79% → same level
    // <50% → revision required
  },

  // Recommendation thresholds
  eligibilityThresholds: {
    minMatchForRecommendation: 30,  // Show roles with ≥30% match
    strongMatchThreshold: 75,        // Strong fit indicator
    moderateMatchThreshold: 50,      // Moderate fit indicator
  },

  // Learning materials configuration
  learningMaterials: {
    maxResourcesPerSkill: 5,
    levelProgression: ['beginner', 'intermediate', 'advanced'],
    searchEngineBase: 'https://www.google.com/search?q=',
  },

  // Assessment configuration
  assessment: {
    questionsPerAttempt: 10,
    timePerQuestion: 90,  // seconds
    minTimeBetweenAttempts: 0,  // seconds (0 = no cooldown for dev)
    maxAttemptsPerDay: 3,
    penaltyForRepetition: 0.1,  // 10% penalty for repeating same question
  },

  // XAI (Explainable AI) templates
  explanationTemplates: {
    excellent: "Excellent match! You have {skillMatchScore}% of required skills and {interestMatchScore}% interest alignment.",
    good: "Good match with {matchPercentage}% overall compatibility. Focus on developing missing skills to improve.",
    moderate: "Moderate fit at {matchPercentage}%. Consider this as a growth opportunity if interested.",
    needsWork: "This role requires significant upskilling. Current match: {matchPercentage}%. Review improvement suggestions.",
  },
};
