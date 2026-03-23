/**
 * Clean up broken active assessments
 * Run: node scripts/cleanBrokenAssessments.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/student-recommendation');

const Assessment = require('../models/Assessment');

async function cleanBrokenAssessments() {
  try {
    console.log('🔍 Searching for broken assessments...\n');

    const allAssessments = await Assessment.find({ status: 'active' });
    console.log(`📊 Found ${allAssessments.length} active assessments`);

    const brokenAssessments = allAssessments.filter(assessment => {
      return assessment.questions.some(q => {
        // Check for undefined or placeholder patterns
        const hasUndefinedQuestion = !q.questionText || q.questionText === 'undefined';
        const hasPlaceholderOptions = q.options.some(opt => 
          /\{opt\d+\}|\{scenario\d+\}|\{practice\d+\}/.test(opt)
        );
        return hasUndefinedQuestion || hasPlaceholderOptions;
      });
    });

    console.log(`🔴 Found ${brokenAssessments.length} broken assessments\n`);

    if (brokenAssessments.length === 0) {
      console.log('✅ No broken assessments found!');
      process.exit(0);
    }

    // Show details
    brokenAssessments.forEach((assessment, idx) => {
      console.log(`${idx + 1}. Skill: ${assessment.skillName}, Level: ${assessment.level}`);
      console.log(`   Student ID: ${assessment.studentId}`);
      console.log(`   Questions: ${assessment.questions.length}`);
      console.log(`   Started: ${assessment.startedAt}`);
    });

    console.log('\n❌ Deleting broken assessments...');
    
    const deleteResult = await Assessment.deleteMany({
      _id: { $in: brokenAssessments.map(a => a._id) }
    });

    console.log(`✅ Deleted ${deleteResult.deletedCount} broken assessments`);
    console.log('\n💡 Students can now retry their assessments.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

cleanBrokenAssessments();
