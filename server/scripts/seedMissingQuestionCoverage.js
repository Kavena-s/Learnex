/**
 * Seed missing question coverage for required role skills.
 *
 * Goals:
 * 1) Ensure every required skill has topics for beginner/intermediate/advanced.
 * 2) Ensure each topic has a baseline question count.
 * 3) Ensure each required skill-level has enough approved questions for assessments.
 * 4) Never insert duplicate question text per skill+level.
 *
 * Run:
 *   node scripts/seedMissingQuestionCoverage.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

const Role = require("../models/Role");
const Skill = require("../models/Skill");
const QuestionTopic = require("../models/QuestionTopic");
const QuestionBank = require("../models/QuestionBank");

const LEVELS = ["beginner", "intermediate", "advanced"];
const MIN_PER_LEVEL = 10;
const MIN_PER_TOPIC = 3;

function normalizeText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function conceptFromTopic(topicName, skillName) {
  const cleanTopic = String(topicName || "").trim();
  if (!cleanTopic) return "Core Concepts";
  const prefix = String(skillName || "").trim();
  if (!prefix) return cleanTopic;
  return cleanTopic.replace(new RegExp(`^${prefix}\s*-\s*`, "i"), "").trim() || cleanTopic;
}

const QUESTION_TEMPLATES = {
  beginner: [
    {
      make: (skill, concept, n) => ({
        questionText: `Which statement best describes ${concept} in ${skill} basics?`,
        options: [
          `It explains a core beginner concept used regularly in ${skill}.`,
          "It is only used in operating system kernel development.",
          "It is unrelated to programming or problem solving.",
          "It can only be applied after publishing to production.",
        ],
        correctAnswer: 0,
      }),
    },
    {
      make: (skill, concept, n) => ({
        questionText: `A beginner in ${skill} is practicing ${concept}. What should they prioritize first?`,
        options: [
          "Understanding the core idea and trying small examples.",
          "Skipping fundamentals and optimizing edge cases.",
          "Memorizing syntax without running examples.",
          "Avoiding debugging to save time.",
        ],
        correctAnswer: 0,
      }),
    },
    {
      make: (skill, concept, n) => ({
        questionText: `In ${skill}, which option is the safest beginner practice for ${concept}?`,
        options: [
          "Use clear naming, validate inputs, and test simple cases.",
          "Disable validation and trust all input data.",
          "Write logic without checking outputs.",
          "Use only copied code without understanding.",
        ],
        correctAnswer: 0,
      }),
    },
    {
      make: (skill, concept, n) => ({
        questionText: `Scenario ${n}: While learning ${skill}, why is ${concept} important?`,
        options: [
          "It supports building reliable solutions step by step.",
          "It eliminates the need for testing forever.",
          "It guarantees zero bugs in any project.",
          "It replaces all other skills automatically.",
        ],
        correctAnswer: 0,
      }),
    },
  ],
  intermediate: [
    {
      make: (skill, concept, n) => ({
        questionText: `In intermediate ${skill}, what is the main benefit of mastering ${concept}?`,
        options: [
          "You can design cleaner solutions and handle real-world constraints.",
          "You no longer need to reason about trade-offs.",
          "You should remove all abstraction to improve readability.",
          "You can skip integration testing entirely.",
        ],
        correctAnswer: 0,
      }),
    },
    {
      make: (skill, concept, n) => ({
        questionText: `A project uses ${skill}. Which intermediate approach for ${concept} is most maintainable?`,
        options: [
          "Modularize logic and document assumptions with tests.",
          "Put all logic into one large function.",
          "Rely on hidden side effects for state updates.",
          "Ignore input constraints and handle failures manually later.",
        ],
        correctAnswer: 0,
      }),
    },
    {
      make: (skill, concept, n) => ({
        questionText: `When applying ${concept} in ${skill}, what should intermediate developers monitor closely?`,
        options: [
          "Correctness, complexity, and failure modes.",
          "Only UI colors and branding choices.",
          "Only code length, not behavior.",
          "Only variable names, not outputs.",
        ],
        correctAnswer: 0,
      }),
    },
    {
      make: (skill, concept, n) => ({
        questionText: `Scenario ${n}: Your ${skill} module using ${concept} has regressions. Best next step?`,
        options: [
          "Add targeted tests, isolate root cause, then refactor safely.",
          "Rewrite everything without reproducing the issue.",
          "Disable failing checks in production.",
          "Keep deploying and wait for user reports.",
        ],
        correctAnswer: 0,
      }),
    },
  ],
  advanced: [
    {
      make: (skill, concept, n) => ({
        questionText: `In advanced ${skill} systems, which strategy improves ${concept} under scale?`,
        options: [
          "Measure bottlenecks, optimize iteratively, and verify with benchmarks.",
          "Assume performance is fine and skip profiling.",
          "Increase complexity before measuring.",
          "Rely only on anecdotal feedback.",
        ],
        correctAnswer: 0,
      }),
    },
    {
      make: (skill, concept, n) => ({
        questionText: `For production-grade ${skill}, what is a robust advanced practice around ${concept}?`,
        options: [
          "Design for observability, resilience, and explicit error recovery.",
          "Handle failures by restarting without diagnostics.",
          "Avoid logs and metrics to reduce noise.",
          "Treat all incidents as user mistakes.",
        ],
        correctAnswer: 0,
      }),
    },
    {
      make: (skill, concept, n) => ({
        questionText: `An advanced review of ${concept} in ${skill} should primarily evaluate what?`,
        options: [
          "Architecture trade-offs, risk, and long-term maintainability.",
          "Only coding style and spacing.",
          "Only number of lines changed.",
          "Only naming conventions in comments.",
        ],
        correctAnswer: 0,
      }),
    },
    {
      make: (skill, concept, n) => ({
        questionText: `Scenario ${n}: A high-load ${skill} service depends on ${concept}. What is the best response plan?`,
        options: [
          "Use staged rollout, monitoring, and rollback-safe changes.",
          "Deploy directly to all users without checks.",
          "Disable alerts to reduce incident noise.",
          "Postpone validation until after release.",
        ],
        correctAnswer: 0,
      }),
    },
  ],
};

function generateUniqueQuestion({ skillName, level, concept, usedTexts, startAt }) {
  const templates = QUESTION_TEMPLATES[level] || QUESTION_TEMPLATES.beginner;

  for (let offset = 0; offset < 200; offset++) {
    const n = startAt + offset + 1;
    const template = templates[offset % templates.length];
    const question = template.make(skillName, concept, n);
    const normalized = normalizeText(question.questionText);

    if (!usedTexts.has(normalized)) {
      usedTexts.add(normalized);
      return {
        questionText: question.questionText,
        options: question.options,
        correctAnswer: question.correctAnswer,
        concept,
      };
    }
  }

  return null;
}

async function ensureTopic(skillName, difficultyLevel) {
  const existing = await QuestionTopic.findOne({
    name: `${skillName} - ${difficultyLevel} core`,
    skillName,
    difficultyLevel,
  });

  if (existing) return existing;

  return QuestionTopic.create({
    name: `${skillName} - ${difficultyLevel} core`,
    description: `Auto-created topic for ${skillName} (${difficultyLevel}) baseline coverage`,
    skillName,
    difficultyLevel,
    isActive: true,
    createdBy: new mongoose.Types.ObjectId(),
  });
}

async function run() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/student-recommender";
  await mongoose.connect(uri);

  const roles = await Role.find({}).populate("requiredSkills", "name").lean();
  const requiredSkills = new Set();

  roles.forEach((role) => {
    (role.requiredSkills || []).forEach((skill) => {
      const name = String(skill?.name || "").trim();
      if (name) requiredSkills.add(name);
    });
  });

  if (!requiredSkills.size) {
    console.log("No required skills found in roles. Nothing to seed.");
    await mongoose.disconnect();
    return;
  }

  const topicCache = new Map();
  let inserted = 0;

  for (const skillName of requiredSkills) {
    for (const level of LEVELS) {
      const topics = await QuestionTopic.find({ skillName, difficultyLevel: level, isActive: true }).lean();
      const topicList = topics.length ? topics : [await ensureTopic(skillName, level).then((t) => t.toObject ? t.toObject() : t)];

      topicCache.set(`${skillName}::${level}`, topicList);

      const existing = await QuestionBank.find({
        status: "approved",
        skillName,
        difficultyLevel: level,
      }).select("questionText topicId").lean();

      const usedTexts = new Set(existing.map((q) => normalizeText(q.questionText)));
      const topicCounts = new Map();
      topicList.forEach((t) => topicCounts.set(String(t._id), 0));
      existing.forEach((q) => {
        const key = q.topicId ? String(q.topicId) : null;
        if (key && topicCounts.has(key)) {
          topicCounts.set(key, topicCounts.get(key) + 1);
        }
      });

      const docs = [];
      let seedIndex = existing.length;

      for (const topic of topicList) {
        const topicId = String(topic._id);
        const current = topicCounts.get(topicId) || 0;
        const neededForTopic = Math.max(0, MIN_PER_TOPIC - current);
        const concept = conceptFromTopic(topic.name, skillName);

        for (let i = 0; i < neededForTopic; i++) {
          const q = generateUniqueQuestion({
            skillName,
            level,
            concept,
            usedTexts,
            startAt: seedIndex,
          });
          if (!q) break;
          seedIndex += 1;

          docs.push({
            topicId: topic._id,
            topicName: topic.name,
            skillName,
            difficultyLevel: level,
            questionText: q.questionText,
            options: q.options,
            correctAnswer: q.correctAnswer,
            concept: q.concept,
            source: "imported",
            status: "approved",
            approvedAt: new Date(),
            tags: ["autoseeded", level],
          });
        }
      }

      const totalAfterTopicFill = existing.length + docs.length;
      const neededForLevel = Math.max(0, MIN_PER_LEVEL - totalAfterTopicFill);

      for (let i = 0; i < neededForLevel; i++) {
        const topic = topicList[i % topicList.length];
        const concept = conceptFromTopic(topic.name, skillName);
        const q = generateUniqueQuestion({
          skillName,
          level,
          concept,
          usedTexts,
          startAt: seedIndex,
        });
        if (!q) break;
        seedIndex += 1;

        docs.push({
          topicId: topic._id,
          topicName: topic.name,
          skillName,
          difficultyLevel: level,
          questionText: q.questionText,
          options: q.options,
          correctAnswer: q.correctAnswer,
          concept: q.concept,
          source: "imported",
          status: "approved",
          approvedAt: new Date(),
          tags: ["autoseeded", level],
        });
      }

      if (docs.length > 0) {
        await QuestionBank.insertMany(docs, { ordered: false });
        inserted += docs.length;
      }

      const finalCount = await QuestionBank.countDocuments({
        status: "approved",
        skillName,
        difficultyLevel: level,
      });

      console.log(`${skillName} (${level}) => ${finalCount} approved questions`);
    }
  }

  console.log(`Inserted ${inserted} new approved questions.`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Seeding failed:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // noop
  }
  process.exit(1);
});
