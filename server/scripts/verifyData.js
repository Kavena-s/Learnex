/**
 * VERIFICATION SCRIPT
 * Checks if questions and roles are properly configured
 */

const mongoose = require('mongoose');
const QuestionBank = require('../models/QuestionBank');
const QuestionTopic = require('../models/QuestionTopic');
const Role = require('../models/Role');
const Skill = require('../models/Skill');
require('dotenv').config();

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/student-recommender';

async function verifyData() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check questions
    const questionCount = await QuestionBank.countDocuments();
    const topicCount = await QuestionTopic.countDocuments();
    console.log('📊 QUESTION BANK STATUS:');
    console.log(`   - Total Questions: ${questionCount}`);
    console.log(`   - Total Topics: ${topicCount}`);

    // Group by skill and level
    const questionsBySkill = await QuestionBank.aggregate([
      { $match: { status: 'approved' } },
      {
        $group: {
          _id: { skill: '$skillName', level: '$difficultyLevel' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.skill': 1, '_id.level': 1 } }
    ]);

    console.log('\n📚 Questions by Skill and Level:');
    questionsBySkill.forEach(item => {
      console.log(`   - ${item._id.skill} (${item._id.level}): ${item.count} questions`);
    });

    // Check roles
    const roleCount = await Role.countDocuments();
    console.log(`\n🎯 CAREER ROLES: ${roleCount} roles configured`);
    
    if (roleCount === 0) {
      console.log('   ⚠️  WARNING: No career roles found! Add roles via faculty panel.');
    } else {
      const roles = await Role.find().select('roleName requiredSkills').populate('requiredSkills', 'name');
      roles.forEach(role => {
        console.log(`   - ${role.roleName} (${role.requiredSkills?.length || 0} required skills)`);
      });
    }

    // Check skills
    const skillCount = await Skill.countDocuments();
    console.log(`\n🔧 SKILLS: ${skillCount} skills configured`);

    console.log('\n✅ Verification complete!');

  } catch (error) {
    console.error('❌ Verification error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

verifyData();
