/**
 * Clean up invalid questions with placeholder options from the database
 * Run: node scripts/cleanInvalidQuestions.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/student-recommendation');

const QuestionBank = require('../models/QuestionBank');

async function cleanInvalidQuestions() {
  try {
    console.log('🔍 Searching for questions with placeholder options...');

    // Find questions with placeholder patterns in options
    const placeholderPatterns = [
      /\{opt\d+\}/,
      /\{scenario\d+\}/,
      /\{practice\d+\}/,
      /\{result\d+\}/
    ];

    const allQuestions = await QuestionBank.find({});
    console.log(`📊 Total questions in database: ${allQuestions.length}`);

    const invalidQuestions = allQuestions.filter(q => {
      return q.options.some(option => {
        return placeholderPatterns.some(pattern => pattern.test(option));
      });
    });

    console.log(`🔴 Found ${invalidQuestions.length} questions with placeholder options`);

    if (invalidQuestions.length === 0) {
      console.log('✅ No invalid questions found. Database is clean!');
      process.exit(0);
    }

    // Show some examples
    console.log('\n📋 Examples of invalid questions:');
    invalidQuestions.slice(0, 5).forEach((q, idx) => {
      console.log(`\n${idx + 1}. ${q.questionText}`);
      console.log(`   Skill: ${q.skillName}, Level: ${q.difficultyLevel}`);
      console.log(`   Options: ${q.options.join(', ')}`);
    });

    console.log('\n❌ Deleting invalid questions...');
    
    const deleteResult = await QuestionBank.deleteMany({
      _id: { $in: invalidQuestions.map(q => q._id) }
    });

    console.log(`✅ Deleted ${deleteResult.deletedCount} invalid questions`);
    console.log('\n💡 You need to add proper questions through the faculty panel at:');
    console.log('   Faculty Dashboard -> Question Bank -> Create Questions');
    console.log('\n⚠️  Make sure to provide actual option text, not placeholders like {opt1}, {opt2}, etc.');

  } catch (error) {
    console.error('❌ Error cleaning questions:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

cleanInvalidQuestions();
