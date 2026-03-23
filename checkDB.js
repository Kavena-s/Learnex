const mongoose = require('mongoose');
const Skill = require('./server/models/Skill');
const Interest = require('./server/models/Interest');
const Role = require('./server/models/Role');
require('dotenv').config();
(async()=>{
  try{
    await mongoose.connect(process.env.MONGO_URI);
    console.log('connected');
    const skills = await Skill.find().lean();
    const interests = await Interest.find().lean();
    const roles = await Role.find().lean();
    console.log('skills', skills.length, skills.map(s=>s.name));
    console.log('interests', interests.length, interests.map(i=>i.name));
    console.log('roles', roles.length, roles.map(r=>r.roleName));
    process.exit(0);
  }catch(e){console.error(e);process.exit(1)}
})();