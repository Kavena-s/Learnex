const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');

let mongod;
let serverProcess;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';

  // start the server (server.js will connect using process.env.MONGO_URI)
  serverProcess = require('../server');

  // ensure mongoose connected
  await mongoose.connect(uri);
});

afterAll(async () => {
  // close mongoose connection
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
  // if serverProcess exported a close function, try to close it
  try {
    if (serverProcess && serverProcess.close) await serverProcess.close();
  } catch (e) {}
});

test('POST /api/profile saves and GET /api/profile returns saved profile', async () => {
  const User = require('../models/User');
  const user = await User.create({ name: 'Test Student', email: 'student@bitsathy.ac.in', role: 'student' });
  const token = jwt.sign({ id: user._id, role: user.role, email: user.email }, process.env.JWT_SECRET);

  const payload = {
    cgpa: 8.25,
    skills: [],
    interests: [],
    projectsDone: [{ domain: 'Web', count: 2 }],
  };

  const res = await request('http://localhost:5000')
    .post('/api/profile')
    .set('Authorization', `Bearer ${token}`)
    .send(payload)
    .expect(200);

  expect(res.body.profile).toBeDefined();
  expect(res.body.profile.cgpa).toBe(8.25);
  expect(Array.isArray(res.body.profile.projectsDone)).toBe(true);
  expect(res.body.profile.projectsDone.length).toBe(1);

  const getRes = await request('http://localhost:5000')
    .get('/api/profile')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  const profile = getRes.body;
  // profile route returns profile directly
  const returnedProfile = profile.profile || profile;
  expect(returnedProfile.cgpa).toBe(8.25);
  expect(Array.isArray(returnedProfile.projectsDone)).toBe(true);
});

// updating the profile should clear any existing recommendations

test('Profile update invalidates old recommendations', async () => {
  const User = require('../models/User');
  const Recommendation = require('../models/Recommendation');

  const user = await User.findOne({ email: 'student@bitsathy.ac.in' });
  const token = jwt.sign({ id: user._id, role: user.role, email: user.email }, process.env.JWT_SECRET);

  // manually insert a fake recommendation for this user
  await Recommendation.create({
    userId: user._id,
    roleName: 'Dummy',
    matchPercentage: 50,
    rank: 1,
  });

  // confirm it exists
  let recs = await Recommendation.find({ userId: user._id });
  expect(recs.length).toBeGreaterThan(0);

  // update profile via API
  await request('http://localhost:5000')
    .post('/api/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({ cgpa: 9 })
    .expect(200);

  recs = await Recommendation.find({ userId: user._id });
  expect(recs.length).toBe(0);
});

// verify that role roadmap endpoint works for authenticated users

test('GET /api/roles/:roleId/roadmap returns roadmap for authenticated user', async () => {
  const User = require('../models/User');
  const Role = require('../models/Role');

  // reuse the same user/token from previous test
  const user = await User.findOne({ email: 'student@bitsathy.ac.in' });
  const token = jwt.sign({ id: user._id, role: user.role, email: user.email }, process.env.JWT_SECRET);

  // create a simple role record
  const role = await Role.create({
    roleName: 'Roadmap Tester',
    description: 'dummy',
    minCGPA: 0,
    minProjects: 0,
    requiredSkills: [],
    preferredSkills: [],
    relatedInterests: [],
    weights: { cgpa: 10, skillMatch: 10, interestMatch: 10, projectRelevance: 10 },
    roadmap: { beginner: 'Start here', intermediate: 'Keep going', advanced: 'You made it' },
    createdBy: user._id,
  });

  const res = await request('http://localhost:5000')
    .get(`/api/roles/${role._id}/roadmap`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(res.body.roleName).toBe('Roadmap Tester');
  expect(res.body.roadmap).toBeDefined();
  expect(res.body.roadmap.beginner).toBe('Start here');
});

// generate recommendations, select one, and verify persistence

test('Recommendation selection updates profile and persists', async () => {
  const User = require('../models/User');
  const Role = require('../models/Role');
  const StudentProfile = require('../models/StudentProfile');

  const user = await User.findOne({ email: 'student@bitsathy.ac.in' });
  const token = jwt.sign({ id: user._id, role: user.role, email: user.email }, process.env.JWT_SECRET);

  // ensure profile exists from earlier
  let profile = await StudentProfile.findOne({ userId: user._id });
  if (!profile) {
    profile = await StudentProfile.create({
      userId: user._id,
      email: user.email,
      name: user.name,
      cgpa: 7.5,
      skills: [],
      interests: [],
      projectsDone: [],
      profileComplete: true,
    });
  }

  // create a role to recommend
  const role = await Role.create({
    roleName: 'Select Test Role',
    description: 'test',
    minCGPA: 5,
    minProjects: 0,
    requiredSkills: [],
    preferredSkills: [],
    relatedInterests: [],
    weights: { cgpa: 20, skillMatch: 40, interestMatch: 25, projectRelevance: 15 },
    roadmap: { beginner: 'B', intermediate: 'I', advanced: 'A' },
    createdBy: user._id,
  });

  // generate recommendations
  const genRes = await request('http://localhost:5000')
    .post('/api/recommend')
    .set('Authorization', `Bearer ${token}`)
    .expect(201);
  expect(genRes.body.recommendations.length).toBeGreaterThan(0);
  // ensure metadata like cgpaGapNeeded is returned
  expect(typeof genRes.body.recommendations[0].cgpaGapNeeded).toBe('number');
  expect(genRes.body.recommendations[0].eligibilityStatus).toBeDefined();

  const recId = genRes.body.recommendations[0]._id;

  // select the first recommendation
  const selRes = await request('http://localhost:5000')
    .put(`/api/recommend/${recId}/select`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(selRes.body.selectedRole).toBeDefined();
  expect(selRes.body.selectedRole.roleId).toBe(String(role._id));

  // fetch profile and ensure selectedRole is updated
  const profRes = await request('http://localhost:5000')
    .get('/api/profile')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  const returnedProfile = profRes.body.profile || profRes.body;
  expect(returnedProfile.selectedRole).toBeDefined();
  expect(String(returnedProfile.selectedRole.roleId)).toBe(String(role._id));

  // fetch recommendations and look for selected flag
  const recsRes = await request('http://localhost:5000')
    .get('/api/recommend')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  const recs = recsRes.body.recommendations || [];
  const selRec = recs.find(r => r._id === recId || String(r._id) === recId);
  expect(selRec).toBeDefined();
  expect(selRec.selected).toBe(true);
  // persisted metadata
  expect(typeof selRec.matchPercentage).toBe('number');
  expect(Array.isArray(selRec.missingSkills)).toBe(true);
  expect(selRec.roleId).toBeDefined();
});
