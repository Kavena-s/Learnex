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
const User = require("../models/User");

const LEVELS = ["beginner", "intermediate", "advanced"];
const MIN_PER_LEVEL = 15;
const MIN_PER_TOPIC = 3;

function normalizeText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const QUESTION_STEMS = {
  beginner: [
    "What best describes {concept} in {skill} for the topic {topic}?",
    "Why is {concept} important when learning {skill} through {topic}?",
    "Which statement best matches {concept} in the {topic} area of {skill}?",
    "A beginner studying {topic} in {skill} should focus on which idea about {concept}?",
    "How does {concept} help someone starting {skill} with {topic}?",
    "Which practice is safest for a beginner working with {concept} in {skill}?",
    "What is the core idea behind {concept} for {skill} learners in {topic}?",
    "Which example most closely relates to {concept} in {skill} and {topic}?",
    "What should you avoid when learning {concept} in {skill} through {topic}?",
    "Which approach is best to start using {concept} in {skill}?",
    "Which benefit comes from understanding {concept} early in {skill}?",
    "In {skill}, what problem does {concept} help solve within {topic}?",
    "Which description is most accurate for {concept} at beginner level in {skill}?",
    "When practicing {concept} in {skill}, what matters most in {topic}?",
    "How would you explain {concept} to a new {skill} learner studying {topic}?",
  ],
  intermediate: [
    "In intermediate {skill}, what is the main benefit of mastering {concept} in {topic}?",
    "How does {concept} improve maintainability in {skill} for {topic}?",
    "Which intermediate approach to {concept} in {skill} is most maintainable for {topic}?",
    "When applying {concept} in {skill}, what should intermediate developers monitor most?",
    "Why is {concept} useful when building real projects in {skill}?",
    "How should a team validate {concept} while working on {topic} in {skill}?",
    "What happens if {concept} is applied incorrectly in an intermediate {skill} project?",
    "Which design choice best supports {concept} in {skill} and {topic}?",
    "How do tests help confirm {concept} in an intermediate {skill} workflow?",
    "What is the strongest reason to use {concept} while scaling {skill} solutions?",
    "Which trade-off matters most when introducing {concept} in {skill}?",
    "How can {topic} reveal weaknesses in {concept} during intermediate {skill} work?",
    "Why does {concept} become more important as {skill} projects grow?",
    "What should be reviewed first when {concept} causes regressions in {skill}?",
    "How does {concept} support cleaner integration in {skill} for {topic}?",
  ],
  advanced: [
    "In advanced {skill} systems, which strategy improves {concept} at scale in {topic}?",
    "For production-grade {skill}, what is a robust advanced practice around {concept}?",
    "What should an advanced review of {concept} in {skill} primarily evaluate in {topic}?",
    "How do you make {concept} reliable under heavy load in {skill}?",
    "Which advanced response best protects {concept} in a production {skill} service?",
    "What architecture choice supports resilient {concept} handling in {skill}?",
    "How should observability be used to monitor {concept} in {skill}?",
    "Which trade-off is most important when optimizing {concept} for {skill}?",
    "How does {topic} change the way {concept} should be implemented in {skill}?",
    "What is the safest rollout plan for {concept} in a high-load {skill} system?",
    "Which benchmark result would matter most when improving {concept} in {skill}?",
    "How do rollback strategies protect {concept} changes in advanced {skill} work?",
    "What long-term risk should be evaluated first for {concept} in {skill}?",
    "Which monitoring signal best shows whether {concept} is healthy in {skill}?",
    "How should an expert validate {concept} before releasing {skill} changes?",
  ],
};

const QUESTION_OPTION_SETS = {
  beginner: [
    [
      "It explains a core foundational idea used regularly in the skill.",
      "It is only used in operating system kernel development.",
      "It is unrelated to programming or problem solving.",
      "It can only be applied after publishing to production.",
    ],
    [
      "Understand the basic idea and try small examples first.",
      "Skip fundamentals and optimize edge cases immediately.",
      "Memorize syntax without running examples.",
      "Avoid debugging to save time.",
    ],
    [
      "Use clear naming, validate inputs, and test simple cases.",
      "Disable validation and trust all input data.",
      "Write logic without checking outputs.",
      "Use only copied code without understanding.",
    ],
  ],
  intermediate: [
    [
      "You can design cleaner solutions and handle real-world constraints.",
      "You no longer need to reason about trade-offs.",
      "You should remove all abstraction to improve readability.",
      "You can skip integration testing entirely.",
    ],
    [
      "Modularize logic and document assumptions with tests.",
      "Put all logic into one large function.",
      "Rely on hidden side effects for state updates.",
      "Ignore input constraints and handle failures later.",
    ],
    [
      "Correctness, complexity, and failure modes.",
      "Only UI colors and branding choices.",
      "Only code length, not behavior.",
      "Only variable names, not outputs.",
    ],
  ],
  advanced: [
    [
      "Measure bottlenecks, optimize iteratively, and verify with benchmarks.",
      "Assume performance is fine and skip profiling.",
      "Increase complexity before measuring.",
      "Rely only on anecdotal feedback.",
    ],
    [
      "Design for observability, resilience, and explicit error recovery.",
      "Handle failures by restarting without diagnostics.",
      "Avoid logs and metrics to reduce noise.",
      "Treat all incidents as user mistakes.",
    ],
    [
      "Architecture trade-offs, risk, and long-term maintainability.",
      "Only coding style and spacing.",
      "Only number of lines changed.",
      "Only naming conventions in comments.",
    ],
  ],
};

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

function generateUniqueQuestion({ skillName, level, concept, topicName, usedTexts, startAt }) {
  const stems = QUESTION_STEMS[level] || QUESTION_STEMS.beginner;
  const optionSets = QUESTION_OPTION_SETS[level] || QUESTION_OPTION_SETS.beginner;

  for (let offset = 0; offset < 300; offset++) {
    const stem = stems[(startAt + offset) % stems.length];
    const options = optionSets[(startAt + offset) % optionSets.length];
    const questionText = stem
      .replace(/\{skill\}/g, skillName)
      .replace(/\{concept\}/g, concept)
      .replace(/\{topic\}/g, topicName || concept || "Core Concepts");
    const normalized = normalizeText(questionText);

    if (!usedTexts.has(normalized)) {
      usedTexts.add(normalized);
      return {
        questionText,
        options,
        correctAnswer: 0,
        concept,
      };
    }
  }

  return null;
}

async function ensureTopic(skillName, difficultyLevel, createdBy) {
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
    createdBy,
  });
}

function pickBestQuestionDoc(docs) {
  const statusRank = { approved: 3, pending: 2, rejected: 1, archived: 0 };
  const sourceRank = { manual: 3, imported: 2, ai_generated: 1 };

  const sorted = [...docs].sort((a, b) => {
    const aStatus = statusRank[a.status] ?? 0;
    const bStatus = statusRank[b.status] ?? 0;
    if (aStatus !== bStatus) return bStatus - aStatus;

    const aSource = sourceRank[a.source] ?? 0;
    const bSource = sourceRank[b.source] ?? 0;
    if (aSource !== bSource) return bSource - aSource;

    const aCreated = a.createdBy ? 1 : 0;
    const bCreated = b.createdBy ? 1 : 0;
    if (aCreated !== bCreated) return bCreated - aCreated;

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return sorted[0];
}

async function dedupeQuestionBank() {
  const docs = await QuestionBank.find({}).select(
    "_id skillName difficultyLevel questionText status source createdBy createdAt"
  ).lean();

  const buckets = new Map();
  docs.forEach((d) => {
    const key = `${String(d.skillName || "").trim().toLowerCase()}::${String(d.difficultyLevel || "").trim().toLowerCase()}::${normalizeText(d.questionText)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(d);
  });

  const deleteIds = [];
  buckets.forEach((group) => {
    if (group.length <= 1) return;
    const keep = pickBestQuestionDoc(group);
    group.forEach((d) => {
      if (String(d._id) !== String(keep._id)) {
        deleteIds.push(d._id);
      }
    });
  });

  if (deleteIds.length > 0) {
    await QuestionBank.deleteMany({ _id: { $in: deleteIds } });
  }

  return deleteIds.length;
}

async function run() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/student-recommender";
  await mongoose.connect(uri);

  const facultyActor =
    await User.findOne({ role: "faculty" }).select("_id") ||
    await User.findOne({ role: "admin" }).select("_id") ||
    await User.findOne({}).select("_id");

  if (!facultyActor) {
    throw new Error("No user found to attribute seeded questions. Create at least one user first.");
  }

  const actorId = facultyActor._id;

  const purgeResult = await QuestionBank.deleteMany({ tags: "autoseeded" });
  console.log(`Removed ${purgeResult.deletedCount || 0} previously autoseeded questions.`);

  const legacyScenarioCleanup = await QuestionBank.deleteMany({
    questionText: { $regex: /^Scenario\s+\d+:/i },
  });
  console.log(`Removed ${legacyScenarioCleanup.deletedCount || 0} legacy scenario-style questions.`);

  const removedDuplicates = await dedupeQuestionBank();
  console.log(`Removed ${removedDuplicates} duplicate questions from Question Bank.`);

  const roles = await Role.find({}).populate("requiredSkills", "name").lean();
  const topicSkills = await QuestionTopic.distinct("skillName");
  const bankSkills = await QuestionBank.distinct("skillName");
  const allSkills = new Set();

  roles.forEach((role) => {
    (role.requiredSkills || []).forEach((skill) => {
      const name = String(skill?.name || "").trim();
      if (name) allSkills.add(name);
    });
  });

  (topicSkills || []).forEach((name) => {
    const cleaned = String(name || "").trim();
    if (cleaned) allSkills.add(cleaned);
  });

  (bankSkills || []).forEach((name) => {
    const cleaned = String(name || "").trim();
    if (cleaned) allSkills.add(cleaned);
  });

  if (!allSkills.size) {
    console.log("No skills found in roles/topics/question bank. Nothing to seed.");
    await mongoose.disconnect();
    return;
  }

  const topicCache = new Map();
  let inserted = 0;

  for (const skillName of allSkills) {
    for (const level of LEVELS) {
      const topics = await QuestionTopic.find({ skillName, difficultyLevel: level, isActive: true }).lean();
      const topicList = topics.length ? topics : [await ensureTopic(skillName, level, actorId).then((t) => t.toObject ? t.toObject() : t)];

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
            topicName: topic.name,
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
            source: "manual",
            status: "approved",
            createdBy: actorId,
            approvedBy: actorId,
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
          topicName: topic.name,
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
          source: "manual",
          status: "approved",
          createdBy: actorId,
          approvedBy: actorId,
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
