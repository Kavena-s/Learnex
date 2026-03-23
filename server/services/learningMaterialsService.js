/**
 * LEARNING MATERIALS SERVICE
 * Generates safe, contextual learning resource URLs
 */

const config = require('../config/recommendationConfig');

/**
 * Generate Google search URL for a skill/topic
 * @param {string} skill - Skill name
 * @param {string} level - beginner|intermediate|advanced
 * @returns {string} Safe Google search URL
 */
function generateSearchURL(skill, level = 'beginner') {
  const levelTerms = {
    beginner: 'tutorial for beginners',
    intermediate: 'intermediate guide',
    advanced: 'advanced techniques',
  };

  const searchTerm = `${skill} ${levelTerms[level] || levelTerms.beginner}`;
  const encodedQuery = encodeURIComponent(searchTerm);
  
  return `${config.learningMaterials.searchEngineBase}${encodedQuery}`;
}

/**
 * Get curated learning materials for a skill
 * @param {string} skill - Skill name
 * @param {string} level - Learning level
 * @param {Array} weakConcepts - Optional weak concepts for targeted resources
 * @returns {Object} Learning materials structure
 */
function getLearningMaterials(skill, level = 'beginner', weakConcepts = []) {
  const materials = {
    skill,
    level,
    resources: [],
  };

  // Primary learning resource
  materials.resources.push({
    type: 'tutorial',
    title: `${skill} - ${level} Tutorial`,
    url: generateSearchURL(skill, level),
    description: `Comprehensive ${level}-level ${skill} tutorial`,
    priority: 'high',
  });

  // Video tutorials
  materials.resources.push({
    type: 'video',
    title: `${skill} Video Course`,
    url: generateSearchURL(`${skill} video course`, level),
    description: `Video-based learning for ${skill}`,
    priority: 'medium',
  });

  // Documentation
  materials.resources.push({
    type: 'documentation',
    title: `${skill} Official Documentation`,
    url: generateSearchURL(`${skill} official documentation`, level),
    description: `Official ${skill} documentation and guides`,
    priority: 'medium',
  });

  // Practice resources
  materials.resources.push({
    type: 'practice',
    title: `${skill} Practice Exercises`,
    url: generateSearchURL(`${skill} practice exercises`, level),
    description: `Hands-on exercises to master ${skill}`,
    priority: 'high',
  });

  // Weak concept-specific resources
  if (weakConcepts && weakConcepts.length > 0) {
    weakConcepts.slice(0, 3).forEach(concept => {
      materials.resources.push({
        type: 'targeted',
        title: `${concept} Explained`,
        url: generateSearchURL(`${skill} ${concept} tutorial`, level),
        description: `Targeted help for ${concept}`,
        priority: 'high',
        targetedConcept: concept,
      });
    });
  }

  // Limit to configured max
  materials.resources = materials.resources.slice(0, config.learningMaterials.maxResourcesPerSkill);

  return materials;
}

/**
 * Get learning materials for multiple missing skills
 * @param {Array} missingSkills - Array of skill names/objects
 * @param {string} baseLevel - Starting level
 * @returns {Array} Array of learning material objects
 */
function getMaterialsForSkills(missingSkills, baseLevel = 'beginner') {
  if (!Array.isArray(missingSkills) || missingSkills.length === 0) {
    return [];
  }

  return missingSkills.map(skill => {
    const skillName = typeof skill === 'string' ? skill : skill.name || skill.toString();
    return getLearningMaterials(skillName, baseLevel);
  });
}

/**
 * Get level-appropriate materials based on confidence score
 * @param {string} skill - Skill name
 * @param {number} confidenceScore - 0-100
 * @returns {Object} Learning materials at appropriate level
 */
function getMaterialsByConfidence(skill, confidenceScore) {
  let level = 'beginner';
  
  if (confidenceScore >= 70) {
    level = 'advanced';
  } else if (confidenceScore >= 40) {
    level = 'intermediate';
  }

  return getLearningMaterials(skill, level);
}

/**
 * Generate revision materials for failed assessment
 * @param {Object} assessment - Assessment document
 * @returns {Object} Targeted learning materials
 */
function getRevisionMaterials(assessment) {
  const skillName = assessment.skillName || assessment.skill || 'Unknown Skill';
  const weakConcepts = assessment.weakConcepts || [];
  
  // If failed, suggest going down one level
  const level = assessment.level === 'advanced' ? 'intermediate' :
                assessment.level === 'intermediate' ? 'beginner' :
                'beginner';

  return getLearningMaterials(skillName, level, weakConcepts);
}

module.exports = {
  generateSearchURL,
  getLearningMaterials,
  getMaterialsForSkills,
  getMaterialsByConfidence,
  getRevisionMaterials,
};
