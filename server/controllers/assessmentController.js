const Assessment = require("../models/Assessment");
const StudentProfile = require("../models/StudentProfile");
const Role = require("../models/Role");
const User = require("../models/User");
const questionService = require("../services/questionGenerationService");
const learningMaterialsService = require("../services/learningMaterialsService");

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

const LEVEL_ORDER = ["beginner", "intermediate", "advanced"];
const FINAL_ASSESSMENT_MIN_SCORE = 90; // Require 90+ score on all levels
const QUESTIONS_PER_ASSESSMENT = 10;

function escapeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getPreviousLevel(level) {
  const idx = LEVEL_ORDER.indexOf(level);
  if (idx <= 0) return null;
  return LEVEL_ORDER[idx - 1];
}

function normalizeSkillName(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Student requests an assessment for a specific level
 * POST /api/assessments
 * Body: { roleId, level, skillName? }
 */
exports.requestAssessment = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { roleId, level, skillName } = req.body;

    // Validate inputs
    if (!roleId || !level) {
      return res
        .status(400)
        .json({ message: "roleId and level are required" });
    }

    if (!["beginner", "intermediate", "advanced"].includes(level)) {
      return res.status(400).json({ message: "Invalid level" });
    }

    // Check if role exists
    const role = await Role.findById(roleId).populate("requiredSkills", "name");
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    let resolvedSkillName = String(skillName || "").trim();
    if (!resolvedSkillName) {
      const requiredSkillNames = (role.requiredSkills || [])
        .map((s) => String(s?.name || "").trim())
        .filter(Boolean);

      if (requiredSkillNames.length === 1) {
        resolvedSkillName = requiredSkillNames[0];
      } else {
        return res.status(400).json({
          message:
            "skillName is required for this role. Provide one required skill to request assessment.",
        });
      }
    }

    // Check if student already has pending/scheduled assessment for this skill + level.
    const existing = await Assessment.findOne({
      studentId,
      roleId,
      skillName: {
        $regex: `^${escapeRegex(resolvedSkillName)}$`,
        $options: "i",
      },
      level,
      status: { $in: ["requested", "scheduled"] },
    });

    if (existing) {
      return res.status(400).json({
        message: `Assessment for ${level} level already requested or scheduled`,
      });
    }

    // Create assessment request
    const assessment = await Assessment.create({
      studentId,
      roleId,
      skillName: resolvedSkillName,
      level,
      status: "requested",
      type: "faculty-scheduled",
      requestedAt: new Date(),
    });

    res.status(201).json({
      message: "Assessment requested successfully",
      assessment,
    });
  } catch (error) {
    console.error("Request assessment error:", error);
    res.status(500).json({ message: "Failed to request assessment" });
  }
};

/**
 * Get all assessment requests (faculty view)
 * Supports filtering by status
 * GET /api/faculty/assessments?status=requested
 */
exports.getAssessmentRequests = async (req, res) => {
  try {
    const { status, scope } = req.query;

    // Build filter
    const filter = {};
    if (status && ["requested", "scheduled", "completed", "declined"].includes(status)) {
      filter.status = status;
    }
    if (scope === "final") {
      filter.$or = [
        { skillName: "Final Assessment" },
        { skillName: { $regex: "^final assessment$", $options: "i" } },
      ];
    }
    if (scope === "normal") {
      filter.$and = [
        { skillName: { $ne: "Final Assessment" } },
        { skillName: { $not: /^final assessment$/i } },
      ];
    }

    // Fetch with populated relationships
    const assessments = await Assessment.find(filter)
      .populate("studentId", "name email")
      .populate("roleId", "roleName")
      .sort({ requestedAt: -1, createdAt: -1 });

    res.json({
      count: assessments.length,
      assessments,
    });
  } catch (error) {
    console.error("Fetch assessments error:", error);
    res.status(500).json({ message: "Failed to fetch assessments" });
  }
};

/**
 * Schedule an assessment (faculty action)
 * PUT /api/faculty/assessments/:assessmentId/schedule
 * Body: { scheduledDate, mode }
 */
exports.scheduleAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { scheduledDate, timeSlot } = req.body;

    // Validate inputs
    if (!scheduledDate || !timeSlot) {
      return res
        .status(400)
        .json({ message: "scheduledDate (YYYY-MM-DD) and timeSlot (FN or AN) are required" });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(scheduledDate)) {
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
    }

    const slot = String(timeSlot).toUpperCase().trim();
    if (!['FN', 'AN'].includes(slot)) {
      return res.status(400).json({ message: "Invalid timeSlot. Use 'FN' (Forenoon) or 'AN' (Afternoon)" });
    }

    // Parse the date and add time
    const dateObj = new Date(scheduledDate + 'T00:00:00');
    dateObj.setHours(slot === 'FN' ? 9 : 14, 0, 0, 0);

    // Check if date is in future
    if (dateObj <= new Date()) {
      return res
        .status(400)
        .json({ message: "Scheduled date/time must be in the future" });
    }

    // Find and update assessment
    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    if (assessment.status !== "requested") {
      return res
        .status(400)
        .json({ message: "Can only schedule assessments with 'requested' status" });
    }

    assessment.status = "scheduled";
    assessment.scheduledDate = dateObj;
    assessment.timeSlot = slot;
    assessment.mode = "online";
    await assessment.save();

    // Populate relationships for response
    await assessment.populate("studentId", "name email");
    await assessment.populate("roleId", "roleName");

    res.json({
      message: "Assessment scheduled successfully",
      assessment,
    });
  } catch (error) {
    console.error("Schedule assessment error:", error);
    res.status(500).json({
      message: "Failed to schedule assessment",
      error: error.message,
      details: error.message || "Unknown server error"
    });
  }
};

/**
 * Complete assessment and mark result (faculty action)
 * PUT /api/faculty/assessments/:assessmentId/complete
 * Body: { result, facultyNotes }
 */
exports.completeAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { result, adminNotes, facultyNotes } = req.body;
    const facultyId = req.user.id;

    // Validate inputs
    if (!result || !["passed", "needs_improvement"].includes(result)) {
      return res
        .status(400)
        .json({ message: "result must be 'passed' or 'needs_improvement'" });
    }

    // Find and update assessment
    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    if (assessment.status !== "scheduled") {
      return res.status(400).json({
        message: "Can only complete assessments with 'scheduled' status",
      });
    }

    assessment.status = "completed";
    assessment.result = result;
    // Keep storing in adminNotes for schema compatibility, but accept facultyNotes from clients.
    assessment.adminNotes = facultyNotes ?? adminNotes ?? "";
    assessment.completedAt = new Date();
    await assessment.save();

    const isFinalAssessment = /^final assessment$/i.test(String(assessment.skillName || "").trim());

    // If passed, update student roadmap progress
    if (result === "passed") {
      const student = await StudentProfile.findOne({
        userId: assessment.studentId,
      });
      if (student && !isFinalAssessment && student.roadmapProgress[assessment.level]) {
        student.roadmapProgress[assessment.level].completed = true;
        student.roadmapProgress[assessment.level].completedAt = new Date();
        await student.save();
      }

      // Final role qualification happens only after final assessment is passed.
      if (student && isFinalAssessment && student.selectedRole?.roleId) {
        const role = await Role.findById(student.selectedRole.roleId).populate("requiredSkills", "name");
        const requiredSkillNames = (role?.requiredSkills || [])
          .map((skill) => String(skill?.name || "").trim())
          .filter(Boolean);

        const finalScore = Number(assessment.score) || 100;
        const levelRank = { beginner: 1, intermediate: 2, advanced: 3 };

        requiredSkillNames.forEach((skillName) => {
          const existingIndex = (student.qualifiedSkills || []).findIndex(
            (q) => String(q.skillName || "").toLowerCase() === skillName.toLowerCase()
          );

          const payload = {
            skillName,
            level: "advanced",
            score: finalScore,
            qualifiedAt: new Date(),
            qualifiedBy: facultyId,
            sourceAssessmentId: assessment._id,
          };

          if (existingIndex >= 0) {
            const existing = student.qualifiedSkills[existingIndex];
            const existingLevelRank = levelRank[existing.level] || 0;
            const existingScore = Number(existing.score) || 0;

            if (existingLevelRank < levelRank.advanced || existingScore < finalScore) {
              student.qualifiedSkills[existingIndex] = payload;
            }
          } else {
            student.qualifiedSkills.push(payload);
          }
        });

        student.selectedRole.finalAssessmentPassed = true;
        student.selectedRole.qualifiedAt = new Date();
        student.selectedRole.qualifiedBy = facultyId;
        student.selectedRole.qualificationAssessmentId = assessment._id;

        const qualifiedRolePayload = {
          roleId: student.selectedRole.roleId,
          roleName: role?.roleName || student.selectedRole.trackName || "Qualified Role",
          trackName: student.selectedRole.trackName || null,
          qualifiedAt: new Date(),
          qualifiedBy: facultyId,
          sourceAssessmentId: assessment._id,
        };

        if (!Array.isArray(student.qualifiedRoles)) {
          student.qualifiedRoles = [];
        }
        const existingQualifiedRoleIndex = student.qualifiedRoles.findIndex(
          (entry) => String(entry?.roleId || "") === String(student.selectedRole.roleId || "")
        );

        if (existingQualifiedRoleIndex >= 0) {
          student.qualifiedRoles[existingQualifiedRoleIndex] = qualifiedRolePayload;
        } else {
          student.qualifiedRoles.push(qualifiedRolePayload);
        }

        await student.save();
      }
    }

    // Populate relationships for response
    await assessment.populate("studentId", "name email");
    await assessment.populate("roleId", "roleName");

    res.json({
      message: "Assessment completed successfully",
      assessment,
    });
  } catch (error) {
    console.error("Complete assessment error:", error);
    res.status(500).json({ message: "Failed to complete assessment" });
  }
};

/**
 * Decline an assessment request (faculty action)
 * PUT /api/faculty/assessments/:assessmentId/decline
 * Body: { reason }
 */
exports.declineAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { reason } = req.body;

    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    if (assessment.status !== "requested") {
      return res.status(400).json({
        message: "Can only decline assessments with 'requested' status",
      });
    }

    assessment.status = "declined";
    assessment.declinedAt = new Date();
    assessment.declineReason = String(reason || "Declined by faculty").trim();
    await assessment.save();

    await assessment.populate("studentId", "name email");
    await assessment.populate("roleId", "roleName");

    res.json({
      message: "Assessment request declined successfully",
      assessment,
    });
  } catch (error) {
    console.error("Decline assessment error:", error);
    res.status(500).json({ message: "Failed to decline assessment" });
  }
};

/**
 * Mark a student as qualified in a specific skill from a completed assessment
 * PUT /api/faculty/assessments/:assessmentId/qualify-skill
 */
exports.qualifySkillFromAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const facultyId = req.user.id;

    const assessment = await Assessment.findById(assessmentId).select(
      "studentId skillName level status score"
    );

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    if (assessment.status !== "completed") {
      return res.status(400).json({ message: "Only completed assessments can be qualified" });
    }

    const skillName = String(assessment.skillName || "").trim();
    if (!skillName || /^final assessment$/i.test(skillName)) {
      return res.status(400).json({ message: "Only skill assessments can be qualified" });
    }

    const score = Number(assessment.score) || 0;
    if (score < 90) {
      return res.status(400).json({
        message: "Only assessments with score 90 or above can be marked as qualified",
      });
    }

    const profile = await StudentProfile.findOne({ userId: assessment.studentId });
    if (!profile) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const levelOrder = { beginner: 1, intermediate: 2, advanced: 3 };
    const newLevelRank = levelOrder[assessment.level] || 0;
    const newScore = score;

    const existingIndex = (profile.qualifiedSkills || []).findIndex(
      (q) => String(q.skillName || "").toLowerCase() === skillName.toLowerCase()
    );

    const payload = {
      skillName,
      level: assessment.level,
      score: newScore,
      qualifiedAt: new Date(),
      qualifiedBy: facultyId,
      sourceAssessmentId: assessment._id,
    };

    if (existingIndex >= 0) {
      const existing = profile.qualifiedSkills[existingIndex];
      const existingLevelRank = levelOrder[existing.level] || 0;
      const existingScore = Number(existing.score) || 0;

      if (newLevelRank > existingLevelRank || (newLevelRank === existingLevelRank && newScore >= existingScore)) {
        profile.qualifiedSkills[existingIndex] = payload;
      }
    } else {
      profile.qualifiedSkills.push(payload);
    }

    await profile.save();

    return res.json({
      message: `${skillName} marked as qualified for this student`,
      qualifiedSkills: profile.qualifiedSkills,
    });
  } catch (error) {
    console.error("Qualify skill error:", error);
    return res.status(500).json({ message: "Failed to qualify skill" });
  }
};

/**
 * Get assessment history for a specific student (faculty view)
 * GET /api/faculty/assessments/student/:studentId
 */
exports.getStudentAssessmentHistory = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Verify student exists
    const student = await StudentProfile.findOne({ userId: studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Fetch assessment history
    const assessments = await Assessment.find({ studentId })
      .populate("roleId", "roleName")
      .sort({ requestedAt: -1, createdAt: -1 });

    res.json({
      studentName: student.name,
      studentEmail: student.email,
      count: assessments.length,
      assessments,
    });
  } catch (error) {
    console.error("Fetch student assessment history error:", error);
    res.status(500).json({ message: "Failed to fetch student assessment history" });
  }
};

/**
 * Get student's own assessment requests (student view)
 * GET /api/assessments/my
 */
exports.getMyAssessments = async (req, res) => {
  try {
    const studentId = req.user.id;

    const assessments = await Assessment.find({ studentId })
      .populate("roleId", "roleName")
      .sort({ requestedAt: -1, createdAt: -1 });

    res.json({
      count: assessments.length,
      assessments,
    });
  } catch (error) {
    console.error("Fetch my assessments error:", error);
    res.status(500).json({ message: "Failed to fetch your assessments" });
  }
};

/**
 * ========================================
 * ADAPTIVE ASSESSMENT SYSTEM - NEW ENDPOINTS
 * ========================================
 */

/**
 * Start a new adaptive assessment
 * POST /api/assessments/start
 * Body: { skillName, level }
 */
exports.startAdaptiveAssessment = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { skillName, level } = req.body;
    const normalizedSkillName = String(skillName || "").trim();

    // Validate inputs
    if (!normalizedSkillName || !level) {
      return res.status(400).json({ message: "skillName and level are required" });
    }

    if (!["beginner", "intermediate", "advanced"].includes(level)) {
      return res.status(400).json({ message: "Invalid level" });
    }

    // Enforce level progression: beginner -> intermediate -> advanced
    const previousLevel = getPreviousLevel(level);
    if (previousLevel) {
      const previousCompletion = await Assessment.findOne({
        studentId,
        skillName: {
          $regex: `^${escapeRegex(normalizedSkillName)}$`,
          $options: "i",
        },
        level: previousLevel,
        status: "completed",
      })
        .sort({ createdAt: -1 })
        .select("_id score level");

      if (!previousCompletion) {
        return res.status(400).json({
          message: `Complete ${previousLevel} level first before attempting ${level}.`,
        });
      }
    }

    // Stop reattempts once student has already mastered this skill level (90+).
    const masteredAttempt = await Assessment.findOne({
      studentId,
      skillName: {
        $regex: `^${escapeRegex(normalizedSkillName)}$`,
        $options: "i",
      },
      level,
      status: "completed",
      score: { $gte: FINAL_ASSESSMENT_MIN_SCORE },
    })
      .sort({ createdAt: -1 })
      .select("_id score");

    if (masteredAttempt) {
      return res.status(400).json({
        message: `Reattempt not allowed. You already scored ${masteredAttempt.score}% in ${skillName} (${level}).`,
      });
    }

    // Check for active assessment on this skill (integrity: one attempt at a time)
    const activeAssessment = await Assessment.findOne({
      studentId,
      skillName: {
        $regex: `^${escapeRegex(normalizedSkillName)}$`,
        $options: "i",
      },
      status: "active",
    });

    if (activeAssessment) {
      const elapsedSeconds = (Date.now() - new Date(activeAssessment.startedAt).getTime()) / 1000;
      if (Number.isFinite(elapsedSeconds) && elapsedSeconds > (activeAssessment.timeLimit || 1800)) {
        activeAssessment.status = "expired";
        activeAssessment.isTimedOut = true;
        activeAssessment.completedAt = new Date();
        await activeAssessment.save();
      } else {
        return res.status(400).json({
          message: "You already have an active assessment for this skill. Please complete it first.",
          activeAssessmentId: activeAssessment._id,
        });
      }
    }

    const blockingActive = await Assessment.findOne({
      studentId,
      skillName: {
        $regex: `^${escapeRegex(normalizedSkillName)}$`,
        $options: "i",
      },
      status: "active",
    }).select("_id");

    if (blockingActive) {
      return res.status(400).json({
        message: "You already have an active assessment for this skill. Please complete it first.",
        activeAssessmentId: blockingActive._id,
      });
    }

    // Get previous assessment history to avoid question repetition
    const previousAssessments = await Assessment.find({
      studentId,
      skillName: {
        $regex: `^${escapeRegex(normalizedSkillName)}$`,
        $options: "i",
      },
      status: { $in: ["completed", "reviewed"] },
    }).sort({ createdAt: -1 }).limit(3);

    const previousQuestions = previousAssessments.flatMap(a => a.questions || []);

    // Generate dynamic questions (now async with LLM)
    const questions = await questionService.generateQuestions(
      normalizedSkillName,
      level,
      QUESTIONS_PER_ASSESSMENT,
      previousQuestions
    );
    
    console.log(`[Assessment] Generated ${questions.length} questions for ${skillName} ${level}`);
    
    if (questions.length === 0) {
      return res.status(400).json({ 
        message: `No questions available for ${skillName} at ${level} level. Please add questions to the Question Bank first.`
      });
    }

    // Deduplicate questions within this assessment (same question text = duplicate)
    const seenQuestionTexts = new Set();
    const deduplicatedQuestions = [];
    
    questions.forEach(q => {
      const qText = String(q.questionText || '').trim().toLowerCase();
      if (!seenQuestionTexts.has(qText)) {
        seenQuestionTexts.add(qText);
        deduplicatedQuestions.push(q);
      } else {
        console.warn(`[Assessment] Filtered out duplicate question in same assessment: "${q.questionText.substring(0, 50)}..."`);
      }
    });
    
    console.log(`[Assessment] After dedup: ${deduplicatedQuestions.length} unique questions in assessment`);

    // Question options are already shuffled in the generation service; avoid re-shuffling here.
    const randomizedQuestions = shuffleArray(deduplicatedQuestions);

    // Create new assessment
    const assessment = await Assessment.create({
      studentId,
      skillName,
      level,
      type: "self-paced",
      status: "active",
      questions: randomizedQuestions.map(q => ({
        questionText: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer,
        concept: q.concept,
        difficulty: q.difficulty,
        generatedAt: q.generatedAt,
      })),
      startedAt: new Date(),
      timeLimit: 1800, // 30 minutes
      totalQuestions: randomizedQuestions.length,
      warningsCount: 0,
      maxWarnings: 3, // Secure Exam Mode
    });

    // Return questions without correct answers
    const questionsForStudent = assessment.questions.map((q, idx) => ({
      questionNumber: idx + 1,
      questionText: q.questionText,
      options: q.options,
      concept: q.concept, // Help students understand what's being tested
    }));

    res.status(201).json({
      message: "Assessment started successfully",
      assessmentId: assessment._id,
      skillName,
      level,
      totalQuestions: randomizedQuestions.length,
      timeLimit: assessment.timeLimit,
      startedAt: assessment.startedAt,
      maxWarnings: assessment.maxWarnings,
      expiresAt: new Date(assessment.startedAt.getTime() + assessment.timeLimit * 1000),
      questions: questionsForStudent,
    });
  } catch (error) {
    console.error("Start adaptive assessment error:", error);

    const message = String(error?.message || "");
    const isExpectedValidationError =
      message.includes("No approved question bank entries") ||
      message.includes("No approved questions mapped to active topics") ||
      message.includes("No fresh questions left") ||
      message.includes("required") ||
      message.includes("Invalid level");

    if (isExpectedValidationError) {
      return res.status(400).json({ message });
    }

    res.status(500).json({ 
      message: "Failed to start assessment",
      error: error.message,
    });
  }
};

/**
 * Submit assessment answers
 * POST /api/assessments/:assessmentId/submit
 * Body: { answers: [0, 2, 1, ...] }
 */
exports.submitAssessment = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { assessmentId } = req.params;
    const { answers } = req.body;

    // Validate
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: "answers array is required" });
    }

    // Find assessment
    const assessment = await Assessment.findOne({
      _id: assessmentId,
      studentId,
    });

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    if (assessment.status !== "active") {
      return res.status(400).json({ message: "This assessment is not active" });
    }

    // Check time limit
    const now = new Date();
    const timeElapsed = (now - assessment.startedAt) / 1000; // seconds
    const isTimedOut = timeElapsed > assessment.timeLimit;
    
    // Check if it was forced submission due to cheating
    const forcedSubmission = req.body.forcedSubmission === true;

    // Check answer count (unless forced submission)
    // Always normalize answers to assessment length so late submit/partial answers don't hard-fail.
    const processedAnswers = assessment.questions.map((question, index) => {
      const value = answers[index];
      if (!Number.isInteger(value)) {
        return -1;
      }

      const maxOptionIndex = Array.isArray(question?.options)
        ? Math.max(0, question.options.length - 1)
        : -1;

      if (value < 0 || value > maxOptionIndex) {
        return -1;
      }

      return value;
    });

    // Analyze performance
    const performance = questionService.analyzePerformance(
      assessment.questions,
      processedAnswers
    );

    // Update assessment
    assessment.answers = processedAnswers;
    assessment.submittedAt = now;
    assessment.isTimedOut = isTimedOut;
    assessment.forcedSubmission = forcedSubmission;
    assessment.status = "completed";
    assessment.score = performance.score;
    assessment.correctAnswers = performance.correctAnswers;
    assessment.conceptPerformance = performance.conceptPerformance;
    assessment.weakConcepts = performance.weakConcepts;
    assessment.recommendation = performance.recommendation;
    assessment.completedAt = now;

    await assessment.save();

    // If level-up recommended, update student profile
    if (performance.recommendation.nextLevel) {
      const profile = await StudentProfile.findOne({ userId: studentId });
      if (profile && Array.isArray(profile.skills)) {
        // Legacy compatibility: some profiles may not have mutable skill objects.
        const skillIndex = profile.skills.findIndex((s) => {
          const skillName = String(s?.skillName || s?.name || "").trim().toLowerCase();
          return skillName && skillName === String(assessment.skillName || "").trim().toLowerCase();
        });

        if (skillIndex >= 0 && profile.skills[skillIndex] && typeof profile.skills[skillIndex] === "object") {
          const levelMap = { beginner: "intermediate", intermediate: "advanced" };
          profile.skills[skillIndex].proficiencyLevel = levelMap[assessment.level] || "advanced";
          await profile.save();
        }
      }
    }

    // Get learning materials for weak concepts
    let learningMaterials = null;
    if (performance.weakConcepts.length > 0) {
      learningMaterials = learningMaterialsService.getMaterialsForSkills(
        performance.weakConcepts.map(concept => ({
          name: `${assessment.skillName} - ${concept}`,
          level: assessment.level,
        }))
      );
    }

    res.json({
      message: "Assessment submitted successfully",
      score: performance.score,
      totalQuestions: performance.totalQuestions,
      correctAnswers: performance.correctAnswers,
      conceptPerformance: performance.conceptPerformance,
      weakConcepts: performance.weakConcepts,
      recommendation: performance.recommendation,
      learningMaterials: learningMaterials || [],
      timeTaken: Math.round(timeElapsed),
      isTimedOut,
    });
  } catch (error) {
    console.error("Submit assessment error:", error);
    const includeDetails = process.env.NODE_ENV !== "production";
    res.status(500).json({
      message: "Failed to submit assessment",
      ...(includeDetails ? { details: error?.message || String(error) } : {}),
    });
  }
};

/**
 * Register a tab switch warning (Secure Exam Mode)
 * POST /api/assessments/:assessmentId/warning
 */
exports.registerTabSwitchWarning = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { assessmentId } = req.params;

    const assessment = await Assessment.findOne({
      _id: assessmentId,
      studentId,
      status: "active"
    });

    if (!assessment) {
      return res.status(404).json({ message: "Active assessment not found" });
    }

    assessment.warningsCount = (assessment.warningsCount || 0) + 1;
    await assessment.save();

    const exceeded = assessment.warningsCount >= assessment.maxWarnings;

    res.json({
      warningsCount: assessment.warningsCount,
      maxWarnings: assessment.maxWarnings,
      exceeded
    });
  } catch (error) {
    console.error("Tab switch warning error:", error);
    res.status(500).json({ message: "Failed to register warning" });
  }
};

/**
 * Get active assessment for a skill (integrity check)
 * GET /api/assessments/active/:skillName
 */
exports.getActiveAssessment = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { skillName } = req.params;

    const activeAssessment = await Assessment.findOne({
      studentId,
      skillName: {
        $regex: `^${escapeRegex(skillName)}$`,
        $options: "i",
      },
      status: "active",
    });

    if (!activeAssessment) {
      return res.json({ hasActive: false });
    }

    // Check if expired
    const now = new Date();
    const timeElapsed = (now - activeAssessment.startedAt) / 1000;
    const isExpired = timeElapsed > activeAssessment.timeLimit;

    if (isExpired) {
      activeAssessment.status = "expired";
      activeAssessment.isTimedOut = true;
      await activeAssessment.save();

      return res.json({ hasActive: false, wasExpired: true });
    }

    // Return active assessment details
    const questionsForStudent = activeAssessment.questions.map((q, idx) => ({
      questionNumber: idx + 1,
      questionText: q.questionText,
      options: q.options,
      concept: q.concept,
    }));

    res.json({
      hasActive: true,
      assessmentId: activeAssessment._id,
      skillName: activeAssessment.skillName,
      level: activeAssessment.level,
      totalQuestions: activeAssessment.totalQuestions,
      timeLimit: activeAssessment.timeLimit,
      startedAt: activeAssessment.startedAt,
      timeRemaining: Math.max(0, activeAssessment.timeLimit - timeElapsed),
      questions: questionsForStudent,
    });
  } catch (error) {
    console.error("Get active assessment error:", error);
    res.status(500).json({ message: "Failed to check active assessment" });
  }
};

/**
 * Get assessment history with performance analytics
 * GET /api/assessments/history/:skillName?
 */
exports.getAssessmentHistory = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { skillName } = req.params;

    const filter = {
      studentId,
      status: { $in: ["completed", "reviewed", "expired"] },
    };

    if (skillName) {
      filter.skillName = skillName;
    }

    const assessments = await Assessment.find(filter)
      .select("-questions.correctAnswer") // Hide correct answers in history
      .sort({ createdAt: -1 })
      .limit(50);

    // Calculate aggregate stats
    const stats = {
      totalAttempts: assessments.length,
      averageScore: 0,
      skillBreakdown: {},
    };

    if (assessments.length > 0) {
      const totalScore = assessments.reduce((sum, a) => sum + (a.score || 0), 0);
      stats.averageScore = Math.round(totalScore / assessments.length);

      // Breakdown by skill
      assessments.forEach(a => {
        if (!stats.skillBreakdown[a.skillName]) {
          stats.skillBreakdown[a.skillName] = {
            attempts: 0,
            averageScore: 0,
            bestScore: 0,
            latestLevel: a.level,
          };
        }
        stats.skillBreakdown[a.skillName].attempts++;
        stats.skillBreakdown[a.skillName].bestScore = Math.max(
          stats.skillBreakdown[a.skillName].bestScore,
          a.score || 0
        );
      });

      // Calculate average per skill
      Object.keys(stats.skillBreakdown).forEach(skill => {
        const skillAssessments = assessments.filter(a => a.skillName === skill);
        const skillTotal = skillAssessments.reduce((sum, a) => sum + (a.score || 0), 0);
        stats.skillBreakdown[skill].averageScore = Math.round(
          skillTotal / skillAssessments.length
        );
      });
    }

    res.json({
      stats,
      history: assessments,
    });
  } catch (error) {
    console.error("Get assessment history error:", error);
    res.status(500).json({ message: "Failed to fetch assessment history" });
  }
};

/**
 * Get per-skill level summary for dashboard and final eligibility checks
 * GET /api/assessments/summary
 */
exports.getAssessmentSummary = async (req, res) => {
  try {
    const studentId = req.user.id;

    const profile = await StudentProfile.findOne({ userId: studentId }).populate("selectedRole.roleId");
    if (!profile || !profile.selectedRole?.roleId) {
      return res.status(404).json({ message: "No role selected" });
    }

    const role = await Role.findById(profile.selectedRole.roleId).populate("requiredSkills", "name");
    if (!role) {
      return res.status(404).json({ message: "Selected role not found" });
    }

    const requiredSkillNames = (role.requiredSkills || [])
      .map((s) => String(s.name || "").trim())
      .filter(Boolean);

    const completed = await Assessment.find({
      studentId,
      status: "completed",
      level: { $in: LEVEL_ORDER },
    }).select("skillName level score createdAt");

    const summary = {};
    requiredSkillNames.forEach((skill) => {
      summary[skill] = {
        beginner: { bestScore: 0, attempts: 0, lastScore: 0, history: [] },
        intermediate: { bestScore: 0, attempts: 0, lastScore: 0, history: [] },
        advanced: { bestScore: 0, attempts: 0, lastScore: 0, history: [] },
      };
    });

    const requiredSkillByNormalized = new Map(
      requiredSkillNames.map((name) => [normalizeSkillName(name), name])
    );

    completed.forEach((a) => {
      const canonicalSkillName = requiredSkillByNormalized.get(normalizeSkillName(a.skillName));
      if (!canonicalSkillName || !summary[canonicalSkillName] || !summary[canonicalSkillName][a.level]) return;
      const bucket = summary[canonicalSkillName][a.level];
      const score = Number(a.score) || 0;
      bucket.attempts += 1;
      bucket.lastScore = score;
      bucket.bestScore = Math.max(bucket.bestScore, score);
      bucket.history.push({
        score,
        date: a.createdAt,
        assessmentId: a._id
      });
    });

    // Eligibility check: all required skills must have 90+ on beginner, intermediate, advanced
    const unmetRequirements = [];
    requiredSkillNames.forEach((skill) => {
      LEVEL_ORDER.forEach((lvl) => {
        const levelData = summary[skill][lvl];
        const bestScore = levelData?.bestScore || 0;
        const attempts = levelData?.attempts || 0;

        if (attempts === 0 || bestScore < FINAL_ASSESSMENT_MIN_SCORE) {
          unmetRequirements.push({ skill, level: lvl, score: bestScore, attempts });
        }
      });
    });

    res.json({
      roleName: role.roleName,
      requiredSkills: requiredSkillNames,
      levels: LEVEL_ORDER,
      summary,
      finalAssessmentEligible: unmetRequirements.length === 0,
      unmetRequirements,
    });
  } catch (error) {
    console.error("Get assessment summary error:", error);
    res.status(500).json({ message: "Failed to fetch assessment summary" });
  }
};

/**
 * Request final assessment for selected role (Student submits request to faculty)
 * POST /api/assessments/request-final
 */
exports.requestFinalAssessment = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { roleId } = req.body;

    // Get student profile
    const StudentProfile = require("../models/StudentProfile");
    const profile = await StudentProfile.findOne({ userId: studentId })
      .populate("selectedRole.roleId", "roleName");

    if (!profile || !profile.selectedRole?.roleId) {
      return res.status(400).json({
        message: "You must select a career path before requesting final assessment"
      });
    }

    // Check if already have a requested or scheduled final assessment
    const existingRequest = await Assessment.findOne({
      studentId,
      skillName: "Final Assessment",
      status: { $in: ["requested", "scheduled"] }
    });

    if (existingRequest) {
      return res.status(400).json({
        message: "You already have a final assessment request in progress"
      });
    }

    // Eligibility rule (temporary testing mode): each required skill must have
    // beginner/intermediate/advanced completed at least once; score threshold disabled.
    const selectedRoleId = roleId || profile.selectedRole.roleId._id;
    const role = await Role.findById(selectedRoleId).populate("requiredSkills", "name");

    if (!role) {
      return res.status(404).json({ message: "Selected role not found" });
    }

    const requiredSkillNames = (role.requiredSkills || [])
      .map((s) => String(s.name || "").trim())
      .filter(Boolean);

    if (!requiredSkillNames.length) {
      return res.status(400).json({ message: "Role has no required skills configured" });
    }

    const completedAssessments = await Assessment.find({
      studentId,
      status: "completed",
      level: { $in: LEVEL_ORDER },
    }).select("skillName level score");

    const requiredSkillByNormalized = new Map(
      requiredSkillNames.map((name) => [normalizeSkillName(name), name])
    );

    const bestScoreMap = new Map();
    const attemptMap = new Map();
    completedAssessments.forEach((a) => {
      const canonicalSkillName = requiredSkillByNormalized.get(normalizeSkillName(a.skillName));
      if (!canonicalSkillName) return;

      const key = `${canonicalSkillName}::${a.level}`;
      const prev = bestScoreMap.get(key) || 0;
      const current = Number(a.score) || 0;
      if (current > prev) bestScoreMap.set(key, current);
      attemptMap.set(key, (attemptMap.get(key) || 0) + 1);
    });

    // Eligibility check: all required skills must have 90+ on beginner, intermediate, advanced
    const unmetRequirements = [];
    requiredSkillNames.forEach((skill) => {
      LEVEL_ORDER.forEach((lvl) => {
        const score = bestScoreMap.get(`${skill}::${lvl}`) || 0;
        const attempts = attemptMap.get(`${skill}::${lvl}`) || 0;
        if (attempts === 0 || score < FINAL_ASSESSMENT_MIN_SCORE) {
          unmetRequirements.push({ skill, level: lvl, score, attempts });
        }
      });
    });

    if (unmetRequirements.length > 0) {
      return res.status(400).json({
        message: "Final assessment requires 90+ score in beginner, intermediate, and advanced levels for all required skills.",
        unmetRequirements,
      });
    }
    //
    // if (unmetRequirements.length > 0) {
    //   return res.status(400).json({
    //     message: "Final assessment requires completed beginner, intermediate, and advanced attempts for all required skills.",
    //     unmetRequirements,
    //   });
    // }

    // Create assessment request
    const assessment = await Assessment.create({
      studentId,
      roleId: selectedRoleId,
      skillName: "Final Assessment",
      level: "advanced",
      type: "faculty-scheduled",
      status: "requested",
      requestedAt: new Date(),
    });

    res.status(201).json({
      message: "Final assessment request submitted successfully. Faculty will review and schedule it.",
      assessment
    });
  } catch (error) {
    console.error("Request final assessment error:", error);
    res.status(500).json({ message: "Failed to submit final assessment request" });
  }
};
