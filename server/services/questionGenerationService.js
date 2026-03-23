/**
 * QUESTION GENERATION SERVICE
 * Fetches questions from Question Bank database or falls back to templates
 */

const config = require('../config/recommendationConfig');
const QuestionBank = require('../models/QuestionBank');

function shuffleArray(items) {
  const arr = Array.isArray(items) ? [...items] : [];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function shuffleQuestionOptions(question) {
  const options = Array.isArray(question.options) ? question.options : [];
  const indexed = options.map((option, index) => ({ option, index }));
  const shuffled = shuffleArray(indexed);
  const newCorrectAnswer = shuffled.findIndex((item) => item.index === question.correctAnswer);

  return {
    ...question,
    options: shuffled.map((item) => item.option),
    correctAnswer: newCorrectAnswer >= 0 ? newCorrectAnswer : question.correctAnswer,
  };
}

/**
 * Question template bank for various skills and levels
 * Each template can generate multiple variations
 */
const questionTemplates = {
  // Programming skills
  javascript: {
    beginner: [
      {
        concept: 'variables',
        template: 'What is the correct way to declare a {varType} in JavaScript?',
        options: [
          'var {varName} = {value}',
          'let {varName} = {value}',
          'const {varName} = {value}',
          '{varName} := {value}',
        ],
        correctIndex: '{correctIndex}',
        variations: {
          varType: ['variable', 'constant', 'mutable variable'],
          varName: ['x', 'count', 'data', 'value'],
          value: ['10', '"hello"', 'true', '[]'],
          correctIndex: [0, 1, 2],
        },
      },
      {
        concept: 'data-types',
        template: 'Which of the following is NOT a primitive data type in JavaScript?',
        options: ['String', 'Number', 'Boolean', 'Array'],
        correctIndex: 3,
      },
      {
        concept: 'functions',
        template: 'How do you define a {funcType} in JavaScript?',
        options: [
          'function {name}() { }',
          'def {name}(): { }',
          'func {name}() { }',
          'fn {name} { }',
        ],
        correctIndex: 0,
        variations: {
          funcType: ['function', 'named function', 'function declaration'],
          name: ['calculate', 'process', 'handleEvent'],
        },
      },
    ],
    intermediate: [
      {
        concept: 'closures',
        template: 'What will the following code output? function outer() { let count = 0; return function() { count++; return count; } } const counter = outer(); console.log(counter());',
        options: ['0', '1', 'undefined', 'ReferenceError'],
        correctIndex: 1,
      },
      {
        concept: 'promises',
        template: 'Which method is used to handle {promiseState} state of a Promise?',
        options: ['.then()', '.catch()', '.finally()', '.resolve()'],
        correctIndex: '{correctIndex}',
        variations: {
          promiseState: ['successful', 'rejected', 'completed'],
        correctIndex: [0, 1, 2],
        },
      },
    ],
    advanced: [
      {
        concept: 'event-loop',
        template: 'In JavaScript, what is the order of execution: {scenario}?',
        options: [
          'Synchronous code → Microtasks → Macrotasks',
          'Macrotasks → Synchronous code → Microtasks',
          'Microtasks → Macrotasks → Synchronous code',
          'All execute simultaneously',
        ],
        correctIndex: 0,
        variations: {
          scenario: [
            'callbacks',
            'promises vs setTimeout',
            'async/await execution',
          ],
        },
      },
    ],
  },

  // Python skills
  python: {
    beginner: [
      {
        concept: 'syntax',
        template: 'What is the correct syntax to print "{message}" in Python?',
        options: [
          'print("{message}")',
          'console.log("{message}")',
          'echo "{message}"',
          'System.out.println("{message}")',
        ],
        correctIndex: 0,
        variations: {
          message: ['Hello World', 'Welcome', 'Python is great'],
        },
      },
      {
        concept: 'lists',
        template: 'How do you access the {position} element of a list in Python?',
        options: ['list[{index}]', 'list.get({index})', 'list.at({index})', 'list({index})'],
        correctIndex: 0,
        variations: {
          position: ['first', 'last', 'second'],
          index: ['0', '-1', '1'],
        },
      },
    ],
    intermediate: [
      {
        concept: 'comprehensions',
        template: 'What is the output of: [{operation} for x in range({n})]?',
        options: ['{result1}', '{result2}', '{result3}', 'SyntaxError'],
        correctIndex: 0,
        variations: {
          operation: ['x*2', 'x**2', 'x+1'],
          n: ['3', '5'],
          result1: ['[0, 2, 4]', '[0, 1, 4]', '[1, 2, 3]'],
        },
      },
    ],
  },

  // Generic skills (can be used for any skill if no specific templates)
  generic: {
    beginner: [
      {
        concept: 'fundamentals',
        template: 'What is the primary purpose of {skill}?',
        options: [
          'To build and structure content',
          'To style and design layouts',
          'To add interactivity',
          'To manage databases'
        ],
        correctIndex: 0,
        variations: {
          skill: ['HTML', 'CSS', 'JavaScript', 'Python', 'Java']
        }
      },
    ],
    intermediate: [
      {
        concept: 'application',
        template: 'In what scenario would you use {skill}?',
        options: [
          'When building dynamic web applications',
          'When creating static documents only',
          'When managing hardware',
          'When designing physical products'
        ],
        correctIndex: 0,
        variations: {
          skill: ['frameworks', 'libraries', 'APIs', 'databases']
        }
      },
    ],
    advanced: [
      {
        concept: 'optimization',
        template: 'What is a best practice for {skill} in production environments?',
        options: [
          'Optimize for performance and scalability',
          'Ignore error handling',
          'Use deprecated features',
          'Avoid documentation'
        ],
        correctIndex: 0,
        variations: {
          skill: ['code deployment', 'database queries', 'API calls', 'caching']
        }
      },
    ],
  },
};

/**
 * Generate a random variation of a template
 * @param {Object} template - Question template
 * @returns {Object} Generated question with variations applied
 */
function generateVariation(template) {
  if (!template.variations) {
    // Validate that template doesn't have unreplaced placeholders
    const placeholderPattern = /\{[^}]+\}/g;
    const questionHasPlaceholder = placeholderPattern.test(template.template);
    const optionsHavePlaceholder = template.options.some(opt => placeholderPattern.test(opt));
    
    if (questionHasPlaceholder || optionsHavePlaceholder) {
      console.warn('⚠️  Template has placeholders but no variations defined:', template.concept);
    }
    
    return {
      ...template,
      question: template.template,
      options: template.options,
      correctIndex: template.correctIndex
    };
  }

  let question = template.template;
  let options = [...template.options];
  let correctIndex = template.correctIndex;

  // Apply variations
  Object.entries(template.variations).forEach(([key, values]) => {
    const randomValue = values[Math.floor(Math.random() * values.length)];
    const placeholder = `{${key}}`;
    
    question = question.replace(new RegExp(placeholder, 'g'), randomValue);
    options = options.map(opt => opt.replace(new RegExp(placeholder, 'g'), randomValue));
    
    // Handle dynamic correct index
    if (correctIndex === placeholder) {
      correctIndex = randomValue;
    }
  });

  // Validate no unreplaced placeholders remain
  const placeholderPattern = /\{[^}]+\}/g;
  if (placeholderPattern.test(question)) {
    console.error('❌ Unreplaced placeholders in question:', question);
  }
  options.forEach((opt, idx) => {
    if (placeholderPattern.test(opt)) {
      console.error(`❌ Unreplaced placeholder in option ${idx}:`, opt);
    }
  });

  return {
    ...template,
    question,
    options,
    correctIndex: typeof correctIndex === 'string' ? parseInt(correctIndex) : correctIndex,
  };
}

/**
 * Generate dynamic questions for an assessment
 * Fetches questions from Question Bank database, falls back to templates if needed
 * @param {string} skillName - Skill being assessed
 * @param {string} level - beginner|intermediate|advanced
 * @param {number} count - Number of questions to generate
 * @param {Array} previousQuestions - Previously used question concepts to avoid
 * @returns {Array} Array of generated questions
 */
async function generateQuestions(skillName, level, count = 10, previousQuestions = []) {
  try {
    // PRIORITY 1: Fetch from Question Bank database
    console.log(`[QuestionGeneration] Fetching from database for ${skillName} ${level}`);
    const normalizedSkill = String(skillName || '').trim();

    const dbQuestions = await QuestionBank.find({
      skillName: { $regex: `^${normalizedSkill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      difficultyLevel: level,
      status: 'approved'
    });
    
    if (!dbQuestions.length) {
      throw new Error(`No approved question bank entries found for ${normalizedSkill} (${level}). Please add skill-level questions in Faculty > Question Bank.`);
    }

    console.log(`[QuestionGeneration] Found ${dbQuestions.length} approved DB questions for ${normalizedSkill} (${level})`);

    const shuffledDb = shuffleArray(dbQuestions);
    const selected = shuffledDb.slice(0, Math.min(count, shuffledDb.length));

    const normalized = selected.map(q => ({
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      concept: q.concept || q.topicName || 'General',
      difficulty: level,
      skill: normalizedSkill,
      generatedAt: new Date(),
      isAIGenerated: false,
      fromDatabase: true
    }));

    return shuffleArray(normalized.map(shuffleQuestionOptions));
    
  } catch (err) {
    console.error(`[QuestionGeneration] Error generating questions for ${skillName}:`, err.message);
    throw err;
  }
}

/**
 * Analyze assessment performance and identify weak concepts
 * @param {Array} questions - Questions from assessment
 * @param {Array} answers - Student's answers
 * @returns {Object} Performance analysis
 */
function analyzePerformance(questions, answers) {
  const conceptPerformance = {};
  let totalCorrect = 0;

  questions.forEach((question, idx) => {
    const userAnswer = answers[idx];
    const isCorrect = userAnswer === question.correctAnswer;

    if (isCorrect) totalCorrect++;

    if (!conceptPerformance[question.concept]) {
      conceptPerformance[question.concept] = {
        total: 0,
        correct: 0,
      };
    }

    conceptPerformance[question.concept].total++;
    if (isCorrect) {
      conceptPerformance[question.concept].correct++;
    }
  });

  // Identify weak concepts (< 50% correct)
  const weakConcepts = Object.entries(conceptPerformance)
    .filter(([_, stats]) => (stats.correct / stats.total) < 0.5)
    .map(([concept, _]) => concept);

  const score = Math.round((totalCorrect / questions.length) * 100);

  return {
    score,
    totalQuestions: questions.length,
    correctAnswers: totalCorrect,
    conceptPerformance,
    weakConcepts,
    recommendation: getRecommendation(score),
  };
}

/**
 * Get adaptive recommendation based on score
 * @param {number} score - Assessment score (0-100)
 * @returns {Object} Recommendation object
 */
function getRecommendation(score) {
  const rules = config.adaptiveRules;

  if (score >= rules.excellentThreshold) {
    return {
      action: 'level-up',
      message: 'Excellent! You are ready to move to the next level.',
      nextLevel: true,
    };
  } else if (score >= rules.passThreshold) {
    return {
      action: 'continue',
      message: 'Good progress! Practice more at this level for mastery.',
      nextLevel: false,
    };
  } else {
    return {
      action: 'revise',
      message: 'Review the material and try again after strengthening weak concepts.',
      nextLevel: false,
      requiresRevision: true,
    };
  }
}

module.exports = {
  generateQuestions,
  analyzePerformance,
  getRecommendation,
  questionTemplates, // Export for admin to add custom templates
};
