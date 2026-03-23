/**
 * Inspect questions in the database
 * Run: node scripts/inspectQuestions.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/student-recommendation');

const QuestionBank = require('../models/QuestionBank');
const Assessment = require('../models/Assessment');

async function inspectQuestions() {
  try {
    console.log('🔍 Inspecting questions in database...\n');

    // Check QuestionBank
    const questions = await QuestionBank.find({}).limit(5);
    console.log(`📊 Sample questions from QuestionBank (Total: ${await QuestionBank.countDocuments()}):\n`);
    
    questions.forEach((q, idx) => {
      console.log(`${idx + 1}. ${q.questionText}`);
      console.log(`   Skill: ${q.skillName}, Level: ${q.difficultyLevel}, Status: ${q.status}`);
      console.log(`   Options:`);
      q.options.forEach((opt, i) => {
        console.log(`      ${i}${i === q.correctAnswer ? ' (✓)' : ''}: ${opt}`);
      });
      console.log('');
    });

    // Check active assessments
    const activeAssessments = await Assessment.find({ status: 'active' });
    console.log(`\n📝 Active assessments: ${activeAssessments.length}`);
    
    if (activeAssessments.length > 0) {
      console.log('\nSample active assessment questions:');
      const assessment = activeAssessments[0];
      console.log(`Skill: ${assessment.skillName}, Level: ${assessment.level}`);
      console.log(`Questions: ${assessment.questions.length}\n`);
      
      assessment.questions.slice(0, 2).forEach((q, idx) => {
        console.log(`${idx + 1}. ${q.questionText}`);
        console.log(`   Options:`);
        q.options.forEach((opt, i) => {
          console.log(`      ${i}: ${opt}`);
        });
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

inspectQuestions();
