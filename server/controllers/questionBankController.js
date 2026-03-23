const QuestionBank = require("../models/QuestionBank");
const QuestionTopic = require("../models/QuestionTopic");
const Skill = require("../models/Skill");

async function resolveSkillName(skillName, skillId) {
  if (skillId) {
    const skill = await Skill.findById(skillId).select("name");
    if (!skill) return null;
    return String(skill.name || "").trim();
  }

  const normalized = String(skillName || "").trim();
  if (!normalized) return null;

  const skill = await Skill.findOne({
    name: { $regex: `^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  }).select("name");
  return skill ? String(skill.name || "").trim() : null;
}

function normalizeQuestionText(input) {
  return String(input || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function questionAlreadyExists(skillName, difficultyLevel, questionText) {
  const normalized = normalizeQuestionText(questionText);
  if (!normalized) return false;

  const duplicates = await QuestionBank.find({
    skillName: { $regex: `^${escapeRegex(String(skillName || "").trim())}$`, $options: "i" },
    difficultyLevel,
  }).select("questionText");

  return duplicates.some(
    (q) => normalizeQuestionText(q.questionText) === normalized
  );
}

/**
 * ============================================
 * QUESTION BANK CONTROLLER
 * Manage question bank for hybrid assessment system
 * ============================================
 */

/**
 * Get all questions with filters
 * GET /api/admin/questions
 */
exports.getQuestions = async (req, res) => {
  try {
    const { status, skillName, difficultyLevel, source, topicId, page = 1, limit = 50 } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (skillName) filter.skillName = skillName;
    if (difficultyLevel) filter.difficultyLevel = difficultyLevel;
    if (source) filter.source = source;
    if (topicId) filter.topicId = topicId;
    
    const skip = (page - 1) * limit;
    
    const questions = await QuestionBank.find(filter)
      .populate("skillId", "name")
      .populate("topicId", "name skillName difficultyLevel")
      .populate("createdBy", "name email")
      .populate("approvedBy", "name email")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    const total = await QuestionBank.countDocuments(filter);
    
    res.json({
      questions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("❌ Get questions error:", error);
    res.status(500).json({ message: "Failed to fetch questions" });
  }
};

/**
 * Get all question topics
 * GET /api/admin/questions/topics
 */
exports.getTopics = async (req, res) => {
  try {
    const { skillName, difficultyLevel, isActive } = req.query;
    const filter = {};
    if (skillName) filter.skillName = skillName;
    if (difficultyLevel) filter.difficultyLevel = difficultyLevel;
    if (isActive !== undefined) filter.isActive = String(isActive) === "true";

    const topics = await QuestionTopic.find(filter)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    const withCounts = await Promise.all(
      topics.map(async (topic) => {
        const questionCount = await QuestionBank.countDocuments({ topicId: topic._id });
        return { ...topic.toObject(), questionCount };
      })
    );

    res.json({ count: withCounts.length, topics: withCounts });
  } catch (error) {
    console.error("❌ Get topics error:", error);
    res.status(500).json({ message: "Failed to fetch topics" });
  }
};

/**
 * Create question topic
 * POST /api/admin/questions/topics
 */
exports.createTopic = async (req, res) => {
  try {
    const facultyId = req.user.id;
    const { name, description, skillName, difficultyLevel } = req.body;

    if (!name || !skillName || !difficultyLevel) {
      return res.status(400).json({ message: "name, skillName and difficultyLevel are required" });
    }

    const topic = await QuestionTopic.create({
      name: String(name).trim(),
      description: description || "",
      skillName: String(skillName).trim(),
      difficultyLevel,
      createdBy: facultyId,
      isActive: true,
    });

    res.status(201).json({ message: "Topic created successfully", topic });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: "Topic already exists for this skill and difficulty" });
    }
    console.error("❌ Create topic error:", error);
    res.status(500).json({ message: "Failed to create topic" });
  }
};

/**
 * Update question topic
 * PUT /api/admin/questions/topics/:id
 */
exports.updateTopic = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, skillName, difficultyLevel, isActive } = req.body;

    const topic = await QuestionTopic.findById(id);
    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    if (name !== undefined) topic.name = String(name).trim();
    if (description !== undefined) topic.description = description;
    if (skillName !== undefined) topic.skillName = String(skillName).trim();
    if (difficultyLevel !== undefined) topic.difficultyLevel = difficultyLevel;
    if (isActive !== undefined) topic.isActive = Boolean(isActive);

    await topic.save();

    await QuestionBank.updateMany(
      { topicId: topic._id },
      {
        $set: {
          topicName: topic.name,
          skillName: topic.skillName,
          difficultyLevel: topic.difficultyLevel,
        },
      }
    );

    res.json({ message: "Topic updated successfully", topic });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: "Topic already exists for this skill and difficulty" });
    }
    console.error("❌ Update topic error:", error);
    res.status(500).json({ message: "Failed to update topic" });
  }
};

/**
 * Delete topic (only if no questions are linked)
 * DELETE /api/admin/questions/topics/:id
 */
exports.deleteTopic = async (req, res) => {
  try {
    const { id } = req.params;
    const linked = await QuestionBank.countDocuments({ topicId: id });
    if (linked > 0) {
      return res.status(400).json({ message: "Cannot delete topic with existing questions" });
    }

    const topic = await QuestionTopic.findByIdAndDelete(id);
    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    res.json({ message: "Topic deleted successfully" });
  } catch (error) {
    console.error("❌ Delete topic error:", error);
    res.status(500).json({ message: "Failed to delete topic" });
  }
};

/**
 * Migrate legacy questions to topic-based structure
 * POST /api/admin/questions/migrate-topics
 */
exports.migrateQuestionsToTopics = async (req, res) => {
  try {
    const facultyId = req.user.id;
    const legacyQuestions = await QuestionBank.find({
      $or: [
        { topicId: { $exists: false } },
        { topicId: null },
      ],
    }).select("_id skillName difficultyLevel concept");

    if (!legacyQuestions.length) {
      return res.json({
        message: "No legacy questions found. Migration not required.",
        migratedCount: 0,
        topicsCreated: 0,
      });
    }

    const topicCache = new Map();
    let topicsCreated = 0;
    let migratedCount = 0;

    for (const question of legacyQuestions) {
      const skillName = String(question.skillName || "General").trim() || "General";
      const difficultyLevel = question.difficultyLevel || "beginner";
      const concept = String(question.concept || "General").trim() || "General";
      const generatedTopicName = `${skillName} - ${concept}`;
      const key = `${generatedTopicName}::${skillName}::${difficultyLevel}`;

      let topicId = topicCache.get(key);
      if (!topicId) {
        let topic = await QuestionTopic.findOne({
          name: generatedTopicName,
          skillName,
          difficultyLevel,
        }).select("_id");

        if (!topic) {
          topic = await QuestionTopic.create({
            name: generatedTopicName,
            description: `Auto-migrated from legacy questions for concept: ${concept}`,
            skillName,
            difficultyLevel,
            createdBy: facultyId,
            isActive: true,
          });
          topicsCreated += 1;
        }

        topicId = topic._id;
        topicCache.set(key, topicId);
      }

      await QuestionBank.updateOne(
        { _id: question._id },
        {
          $set: {
            topicId,
            topicName: generatedTopicName,
            skillName,
            difficultyLevel,
          },
        }
      );
      migratedCount += 1;
    }

    return res.json({
      message: "Legacy questions migrated successfully",
      migratedCount,
      topicsCreated,
    });
  } catch (error) {
    console.error("❌ Migrate question topics error:", error);
    return res.status(500).json({ message: "Failed to migrate legacy questions" });
  }
};

/**
 * Get single question by ID
 * GET /api/admin/questions/:id
 */
exports.getQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const question = await QuestionBank.findById(id)
      .populate("skillId", "name")
      .populate("createdBy", "name email")
      .populate("approvedBy", "name email");
    
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }
    
    res.json(question);
  } catch (error) {
    console.error("❌ Get question error:", error);
    res.status(500).json({ message: "Failed to fetch question" });
  }
};

/**
 * Create new question manually
 * POST /api/admin/questions
 */
exports.createQuestion = async (req, res) => {
  try {
    const facultyId = req.user.id;
    const {
      topicId,
      skillName,
      skillId,
      difficultyLevel,
      questionText,
      options,
      correctAnswer,
      concept,
      tags
    } = req.body;
    
    // Validation
    if (!questionText || !options || correctAnswer === undefined || !concept) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let resolvedTopic = null;
    if (topicId) {
      resolvedTopic = await QuestionTopic.findById(topicId);
      if (!resolvedTopic) {
        return res.status(404).json({ message: "Topic not found" });
      }
    }

    const resolvedSkillName = await resolveSkillName(
      resolvedTopic?.skillName || skillName,
      skillId
    );
    if (!resolvedSkillName) {
      return res.status(400).json({ message: "Valid skillName or skillId is required" });
    }

    const resolvedDifficulty = resolvedTopic?.difficultyLevel || difficultyLevel;
    if (!["beginner", "intermediate", "advanced"].includes(String(resolvedDifficulty || ""))) {
      return res.status(400).json({ message: "difficultyLevel must be beginner, intermediate, or advanced" });
    }
    
    if (options.length < 2 || options.length > 6) {
      return res.status(400).json({ message: "Options must be between 2 and 6" });
    }
    
    if (correctAnswer < 0 || correctAnswer >= options.length) {
      return res.status(400).json({ message: "Invalid correct answer index" });
    }

    const duplicate = await questionAlreadyExists(
      resolvedSkillName,
      resolvedDifficulty,
      questionText
    );
    if (duplicate) {
      return res.status(409).json({ message: "Duplicate question text already exists for this skill and level" });
    }
    
    const question = await QuestionBank.create({
      topicId: resolvedTopic?._id,
      topicName: resolvedTopic?.name,
      skillName: resolvedSkillName,
      skillId,
      difficultyLevel: resolvedDifficulty,
      questionText,
      options,
      correctAnswer,
      concept,
      source: "manual",
      status: "approved", // Manually created questions are auto-approved
      createdBy: facultyId,
      approvedBy: facultyId,
      approvedAt: new Date(),
      tags: tags || []
    });
    
    res.status(201).json({
      message: "Question created successfully",
      question
    });
  } catch (error) {
    console.error("❌ Create question error:", error);
    res.status(500).json({ message: "Failed to create question" });
  }
};

/**
 * Create multiple questions under a topic
 * POST /api/admin/questions/by-topic
 */
exports.createQuestionsByTopic = async (req, res) => {
  try {
    const facultyId = req.user.id;
    const { topicId, questions } = req.body;

    if (!topicId || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "topicId and non-empty questions array are required" });
    }

    const topic = await QuestionTopic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    const prepared = [];
    const seenInPayload = new Set();
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i] || {};
      const options = Array.isArray(q.options) ? q.options : [];

      if (!q.questionText || !q.concept || options.length < 2 || options.length > 6) {
        return res.status(400).json({ message: `Invalid question payload at index ${i}` });
      }
      if (q.correctAnswer === undefined || q.correctAnswer < 0 || q.correctAnswer >= options.length) {
        return res.status(400).json({ message: `Invalid correctAnswer at index ${i}` });
      }

      const normalized = normalizeQuestionText(q.questionText);
      if (!normalized) {
        return res.status(400).json({ message: `Question text is required at index ${i}` });
      }
      if (seenInPayload.has(normalized)) {
        return res.status(409).json({ message: `Duplicate question text in request payload at index ${i}` });
      }
      seenInPayload.add(normalized);

      const duplicate = await questionAlreadyExists(topic.skillName, topic.difficultyLevel, q.questionText);
      if (duplicate) {
        return res.status(409).json({ message: `Duplicate question text already exists at index ${i}` });
      }

      prepared.push({
        topicId: topic._id,
        topicName: topic.name,
        skillName: topic.skillName,
        difficultyLevel: topic.difficultyLevel,
        questionText: q.questionText,
        options,
        correctAnswer: q.correctAnswer,
        concept: q.concept,
        tags: Array.isArray(q.tags) ? q.tags : [],
        source: "manual",
        status: "approved",
        createdBy: facultyId,
        approvedBy: facultyId,
        approvedAt: new Date(),
      });
    }

    const saved = await QuestionBank.insertMany(prepared);
    res.status(201).json({ message: `${saved.length} questions added to topic`, questions: saved });
  } catch (error) {
    console.error("❌ Create questions by topic error:", error);
    res.status(500).json({ message: "Failed to add questions" });
  }
};

/**
 * Create multiple questions by skill and level (no topic required)
 * POST /api/admin/questions/by-skill
 */
exports.createQuestionsBySkill = async (req, res) => {
  try {
    const facultyId = req.user.id;
    const { skillName, skillId, difficultyLevel, questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "Non-empty questions array is required" });
    }

    const resolvedSkillName = await resolveSkillName(skillName, skillId);
    if (!resolvedSkillName) {
      return res.status(400).json({ message: "Valid skillName or skillId is required" });
    }

    if (!["beginner", "intermediate", "advanced"].includes(String(difficultyLevel || ""))) {
      return res.status(400).json({ message: "difficultyLevel must be beginner, intermediate, or advanced" });
    }

    const prepared = [];
    const seenInPayload = new Set();
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i] || {};
      const options = Array.isArray(q.options) ? q.options : [];

      if (!q.questionText || !q.concept || options.length < 2 || options.length > 6) {
        return res.status(400).json({ message: `Invalid question payload at index ${i}` });
      }
      if (q.correctAnswer === undefined || q.correctAnswer < 0 || q.correctAnswer >= options.length) {
        return res.status(400).json({ message: `Invalid correctAnswer at index ${i}` });
      }

      const normalized = normalizeQuestionText(q.questionText);
      if (!normalized) {
        return res.status(400).json({ message: `Question text is required at index ${i}` });
      }
      if (seenInPayload.has(normalized)) {
        return res.status(409).json({ message: `Duplicate question text in request payload at index ${i}` });
      }
      seenInPayload.add(normalized);

      const duplicate = await questionAlreadyExists(resolvedSkillName, difficultyLevel, q.questionText);
      if (duplicate) {
        return res.status(409).json({ message: `Duplicate question text already exists at index ${i}` });
      }

      prepared.push({
        skillName: resolvedSkillName,
        difficultyLevel,
        questionText: q.questionText,
        options,
        correctAnswer: q.correctAnswer,
        concept: q.concept,
        tags: Array.isArray(q.tags) ? q.tags : [],
        source: "manual",
        status: "approved",
        createdBy: facultyId,
        approvedBy: facultyId,
        approvedAt: new Date(),
      });
    }

    const saved = await QuestionBank.insertMany(prepared);
    res.status(201).json({ message: `${saved.length} questions added`, questions: saved });
  } catch (error) {
    console.error("❌ Create questions by skill error:", error);
    res.status(500).json({ message: "Failed to add questions" });
  }
};

/**
 * Update existing question
 * PUT /api/admin/questions/:id
 */
exports.updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      questionText,
      options,
      correctAnswer,
      concept,
      tags,
      skillName,
      skillId,
      difficultyLevel,
      difficulty_rating,
      quality_score
    } = req.body;
    
    const question = await QuestionBank.findById(id);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }
    
    // Update fields
    if (questionText) question.questionText = questionText;
    if (options) {
      if (options.length < 2 || options.length > 6) {
        return res.status(400).json({ message: "Options must be between 2 and 6" });
      }
      question.options = options;
    }
    if (correctAnswer !== undefined) {
      if (correctAnswer < 0 || correctAnswer >= question.options.length) {
        return res.status(400).json({ message: "Invalid correct answer index" });
      }
      question.correctAnswer = correctAnswer;
    }
    if (concept) question.concept = concept;
    if (tags) question.tags = tags;
    if (req.body.topicId) {
      const topic = await QuestionTopic.findById(req.body.topicId);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found" });
      }
      question.topicId = topic._id;
      question.topicName = topic.name;
      question.skillName = topic.skillName;
      question.difficultyLevel = topic.difficultyLevel;
    } else {
      if (skillName !== undefined || skillId !== undefined) {
        const resolvedSkillName = await resolveSkillName(skillName, skillId);
        if (!resolvedSkillName) {
          return res.status(400).json({ message: "Valid skillName or skillId is required" });
        }
        question.skillName = resolvedSkillName;
      }
      if (difficultyLevel !== undefined) {
        if (!["beginner", "intermediate", "advanced"].includes(String(difficultyLevel))) {
          return res.status(400).json({ message: "difficultyLevel must be beginner, intermediate, or advanced" });
        }
        question.difficultyLevel = difficultyLevel;
      }
      if (skillId !== undefined) {
        question.skillId = skillId || undefined;
      }
      // No topic required in skill-level mode
      question.topicId = undefined;
      question.topicName = undefined;
    }

    if (difficulty_rating) question.difficulty_rating = difficulty_rating;
    if (quality_score) question.quality_score = quality_score;
    
    await question.save();
    
    res.json({
      message: "Question updated successfully",
      question
    });
  } catch (error) {
    console.error("❌ Update question error:", error);
    res.status(500).json({ message: "Failed to update question" });
  }
};

/**
 * Approve a pending question
 * PUT /api/admin/questions/:id/approve
 */
exports.approveQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const facultyId = req.user.id;
    
    const question = await QuestionBank.findById(id);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }
    
    question.status = "approved";
    question.approvedBy = facultyId;
    question.approvedAt = new Date();
    await question.save();
    
    res.json({
      message: "Question approved successfully",
      question
    });
  } catch (error) {
    console.error("❌ Approve question error:", error);
    res.status(500).json({ message: "Failed to approve question" });
  }
};

/**
 * Reject a pending question
 * PUT /api/admin/questions/:id/reject
 */
exports.rejectQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const question = await QuestionBank.findById(id);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }
    
    question.status = "rejected";
    question.rejectionReason = reason || "Quality issues";
    await question.save();
    
    res.json({
      message: "Question rejected successfully",
      question
    });
  } catch (error) {
    console.error("❌ Reject question error:", error);
    res.status(500).json({ message: "Failed to reject question" });
  }
};

/**
 * Delete a question
 * DELETE /api/admin/questions/:id
 */
exports.deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    
    const question = await QuestionBank.findByIdAndDelete(id);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }
    
    res.json({ message: "Question deleted successfully" });
  } catch (error) {
    console.error("❌ Delete question error:", error);
    res.status(500).json({ message: "Failed to delete question" });
  }
};

/**
 * Get question bank statistics
 * GET /api/admin/questions/stats
 */
exports.getQuestionStats = async (req, res) => {
  try {
    const total = await QuestionBank.countDocuments();
    const approved = await QuestionBank.countDocuments({ status: "approved" });
    const pending = await QuestionBank.countDocuments({ status: "pending" });
    const rejected = await QuestionBank.countDocuments({ status: "rejected" });
    
    // By source
    const aiGenerated = await QuestionBank.countDocuments({ source: "ai_generated" });
    const manual = await QuestionBank.countDocuments({ source: "manual" });
    
    // By difficulty
    const beginner = await QuestionBank.countDocuments({ difficultyLevel: "beginner", status: "approved" });
    const intermediate = await QuestionBank.countDocuments({ difficultyLevel: "intermediate", status: "approved" });
    const advanced = await QuestionBank.countDocuments({ difficultyLevel: "advanced", status: "approved" });
    
    // Most used questions
    const mostUsed = await QuestionBank.find({ status: "approved" })
      .sort({ timesUsed: -1 })
      .limit(5)
      .select("questionText skillName timesUsed averageScore");
    
    // By skill
    const bySkill = await QuestionBank.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: "$skillName", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    res.json({
      total,
      byStatus: { approved, pending, rejected },
      bySource: { aiGenerated, manual },
      byDifficulty: { beginner, intermediate, advanced },
      mostUsed,
      bySkill
    });
  } catch (error) {
    console.error("❌ Get question stats error:", error);
    res.status(500).json({ message: "Failed to fetch statistics" });
  }
};

/**
 * Bulk import questions from JSON
 * POST /api/admin/questions/bulk-import
 */
exports.bulkImportQuestions = async (req, res) => {
  try {
    const facultyId = req.user.id;
    const { questions } = req.body;
    
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "Invalid questions array" });
    }
    
    const savedQuestions = [];
    const errors = [];
    
    for (let i = 0; i < questions.length; i++) {
      try {
        const q = questions[i];
        const question = await QuestionBank.create({
          ...q,
          source: "imported",
          status: "pending",
          createdBy: facultyId
        });
        savedQuestions.push(question);
      } catch (err) {
        errors.push({ index: i, error: err.message });
      }
    }
    
    res.status(201).json({
      message: `Imported ${savedQuestions.length} questions`,
      success: savedQuestions.length,
      failed: errors.length,
      errors
    });
  } catch (error) {
    console.error("❌ Bulk import error:", error);
    res.status(500).json({ message: "Failed to import questions" });
  }
};
