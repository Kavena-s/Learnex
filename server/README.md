# Student Recommendation Engine - Backend API

A Node.js/Express backend API for an intelligent student career path recommendation system powered by AI. This system helps students discover suitable career paths based on their skills, interests, assessments, and academic performance.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Server](#running-the-server)
- [API Structure](#api-structure)
- [Database Models](#database-models)
- [Services](#services)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

## Features

- **Firebase Authentication Integration**: Server-side token verification with JWT issuance
- **AI-Powered Recommendations**: Generates personalized career path recommendations based on student profiles
- **Adaptive Assessments**: Supports both legacy faculty-scheduled and self-paced adaptive assessment flows
- **Skill Gap Analysis**: Identifies missing skills for target roles
- **Analytics Dashboard**: Comprehensive metrics on student engagement, readiness, and assessment performance
- **Role-Based Access Control**: Separate endpoints for students and faculty
- **Multi-Environment CORS**: Environment-driven origin validation for secure cross-origin requests

## Architecture

### Tech Stack
- **Runtime**: Node.js (v14+)
- **Framework**: Express.js
- **Database**: MongoDB
- **Authentication**: Firebase Admin SDK + JWT
- **AI Service**: Integration-ready for recommendation logic

### Key Components

```
├── app.js              # Express app factory (separated from server startup)
├── server.js           # Server bootstrap and lifecycle management
├── config/             # Database and recommendation configuration
├── controllers/        # Route handlers (business logic)
├── middleware/         # Auth, CORS, and custom middleware
├── models/             # Mongoose schemas
├── routes/             # API endpoint definitions
├── services/           # AI recommendations, analytics, learning materials
└── tests/              # Integration tests
```

### Design Decisions

1. **App Factory Pattern**: `app.js` exports a clean Express app; `server.js` handles startup. Enables testability and container orchestration.

2. **Schema Compatibility Layer**: Recommendation, Assessment, and Analytics services support both legacy and current field names (e.g., `isSelected`/`selected`, `readinessIndex`/`matchPercentage`) to allow seamless mixed-data production deployments.

3. **Environment-Driven Configuration**: All secrets, CORS origins, and faculty emails loaded from environment variables at startup.

4. **Defensive Error Handling**: Auth middleware and services fail safely with descriptive 401/400 responses instead of 500 crashes.

## Prerequisites

- **Node.js** v14 or later (v16+ recommended)
- **MongoDB** v4.4 or later (local or Atlas)
- **Firebase Project** (for faculty credentials and web config)
- **npm** or **yarn** (included with Node.js)

## Installation

### 1. Clone and Navigate

```bash
git clone <repository-url>
cd student-recommendation-engine/server
```

### 2. Install Dependencies

```bash
npm install
```

This installs:
- `express` - Web framework
- `mongoose` - MongoDB ORM
- `firebase-admin` - Firebase server SDK
- `jsonwebtoken` - JWT handling
- `dotenv` - Environment configuration
- `cors` - Cross-origin request handling
- `axios` - HTTP client (for external services if needed)
- Dev dependencies: `nodemon` (auto-reload), `jest` (testing)

### 3. Environment Configuration

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Open `.env` and update all required fields (see [Configuration](#configuration) below).

## Configuration

### Firebase Admin Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project → **Project Settings** → **Service Accounts**
3. Click **Generate New Private Key**
4. Copy the JSON and extract:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the `\n` escape sequences)

**Example `.env` file:**

```env
# MongoDB
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/student-recommendation-engine

# Firebase
FIREBASE_PROJECT_ID=my-project-abc123
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xyz@my-project-abc123.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG...\n-----END PRIVATE KEY-----\n"

# JWT
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://app.yourdomain.com

# Faculty
FACULTY_EMAILS=faculty@yourdomain.com,leadfaculty@yourdomain.com

# Server
PORT=5000
NODE_ENV=production
```

### Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `MONGO_URI` | Yes | MongoDB connection string | `mongodb://localhost:27017/student-rec` |
| `FIREBASE_PROJECT_ID` | Yes | Firebase project ID | `my-project-id` |
| `FIREBASE_CLIENT_EMAIL` | Yes | Firebase service account email | `firebase-adminsdk-xyz@...` |
| `FIREBASE_PRIVATE_KEY` | Yes | Firebase private key (with `\n`) | `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"` |
| `JWT_SECRET` | Yes | Secret for signing JWTs | Use `openssl rand -base64 32` |
| `CORS_ALLOWED_ORIGINS` | Yes | Comma-separated CORS origins | `http://localhost:3000,https://app.com` |
| `FACULTY_EMAILS` | Yes | Comma-separated faculty emails | `faculty@example.com,lead@example.com` |
| `PORT` | No | Server port (default: 5000) | `5000` |
| `NODE_ENV` | No | Environment (development/production) | `production` |

## Running the Server

### Development (with auto-reload)

```bash
npm run dev
```

This uses `nodemon` to automatically restart on file changes.

Output:
```
Server running on http://localhost:5000
✅ Connected to MongoDB
```

### Production

```bash
npm start
```

Or with process manager:

```bash
npm install -g pm2
pm2 start server.js --name "student-rec-api"
pm2 logs student-rec-api
```

### Health Check

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{ "status": "ok", "timestamp": "2026-03-04T10:30:00Z" }
```

## API Structure

### Authentication Flow

1. **Client**: User signs in with Google → Firebase Client SDK returns `idToken`
2. **Client → Backend**: POST `/api/auth/register` with `{ idToken, email }`
3. **Backend**: Verifies `idToken` signature with Firebase Admin SDK
4. **Backend → Client**: Returns `{ token: "jwt_token", role: "student" }`
5. **Client**: Stores JWT in localStorage, includes in `Authorization: Bearer` header
6. **Subsequent Requests**: Backend validates JWT, extracts user ID

### Core Endpoints

#### Authentication
- `POST /api/auth/register` - Register/login with Firebase ID token
- `POST /api/auth/login` - Alternative login endpoint (if no Firebase token)

#### Student Profiles
- `GET /api/profile` - Get current student profile
- `PUT /api/profile` - Update profile, skills, interests
- `GET /api/profile/recommendations` - Get personalized recommendations

#### Assessments
- `GET /api/assessments` - List student assessments
- `POST /api/assessments/:id/submit` - Submit assessment answers
- `PUT /api/assessments/:id/complete` - Mark assessment complete

#### Faculty
- `GET /api/faculty/assessments?status=requested` - List pending assessments
- `POST /api/faculty/assessments/:id/schedule` - Schedule assessment
- `PUT /api/faculty/assessments/:id/complete` - Complete and grade assessment
- `GET /api/faculty/analytics` - Get dashboard metrics
- `POST /api/faculty/skills` - Create skill
- `GET /api/faculty/skills` - List all skills
- `POST /api/faculty/interests` - Create interest
- `GET /api/faculty/interests` - List all interests
- `POST /api/faculty/roles` - Create role
- `GET /api/faculty/roles` - List all roles

## Database Models

### User
Represents a platform user (student or faculty).
```javascript
{
  _id: ObjectId,
  email: String,
  firebaseUid: String,
  role: "student" | "faculty",
  createdAt: Date,
  updatedAt: Date
}
```

### StudentProfile
Student's skills, interests, and assessment history.
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  skills: [{ skillName, proficiencyLevel, yearsOfExperience }],
  interests: [ObjectId],
  selectedRole: ObjectId,
  cgpa: Number,
  assessments: [ObjectId],
  readinessIndex: Number,
  matchPercentage: Number,
  completedAt: Date
}
```

### Recommendation
Career path recommendation generated for a student.
```javascript
{
  _id: ObjectId,
  studentId: ObjectId,
  roleId: ObjectId,
  selected: Boolean,
  readinessIndex: Number,
  matchPercentage: Number,
  createdAt: Date
}
```

### Assessment
Skill assessments (both legacy faculty-scheduled and adaptive self-paced).
```javascript
{
  _id: ObjectId,
  studentId: ObjectId,
  roleId: ObjectId,
  skillName: String,
  type: "faculty-scheduled" | "self-paced",
  status: "requested" | "scheduled" | "active" | "completed" | "expired" | "reviewed",
  score: Number,
  requestedAt: Date,
  scheduledDate: Date,
  completedAt: Date
}
```

### Role
Career role with required skills and learning tracks.
```javascript
{
  _id: ObjectId,
  roleName: String,
  description: String,
  domain: String,
  minCGPA: Number,
  minProjects: Number,
  requiredSkills: [ObjectId],
  tracks: [{
    trackName: String,
    requiredSkills: [ObjectId],
    levels: { beginner, intermediate, advanced }
  }]
}
```

For complete schema documentation, see model files in `/models`.

## Services

### aiRecommendationService
Calculates skill confidence, readiness metrics, and generates top-3 role recommendations.

**Key Functions:**
- `calculateSkillConfidence(student, skillId)` - Dual-field compatible (skillId OR skillName in assessments)
- `getReadinessScore(student, role)` - Overall fit percentage (skills, interests, CGPA, projects)
- `generateRecommendations(studentId, topN=3)` - Returns top N recommended roles with explanations

### analyticsService
Comprehensive platform metrics for faculty dashboard.

**Key Functions:**
- `getDomainPopularity()` - Most recommended career domains
- `getSkillGapTrends()` - Skills most frequently missing in target roles
- `getReadinessMetrics()` - Distribution of student readiness across platform
- `getAssessmentMetrics()` - Pass rates, average scores by skill/level
- `getEngagementMetrics()` - Profile completion, role selection, assessment participation
- `getComprehensiveAnalytics()` - All metrics in one call (runs in parallel)

**Backwards Compatibility:**
- Supports both `selected` and `isSelected` flags in Recommendation queries
- Handles both `matchPercentage` and `readinessIndex` fields
- Aggregates both `userId` and `studentId` field names in distinct() calls
- Safe null-handling throughout (no crashes on missing fields)

### learningMaterialsService
Fetches curated learning resources by skill level.

### questionGenerationService
Generates adaptive assessment questions based on skill and difficulty level.

## Testing

### Run Integration Tests

```bash
npm test
```

Tests are located in `/tests` and use Jest with MongoDB Memory Server for isolation.

### Test Coverage

```bash
npm run test:coverage
```

### Write Tests

Example integration test structure:

```javascript
const request = require('supertest');
const { app, startServer } = require('../server');

describe('Assessment API', () => {
  beforeAll(async () => {
    await startServer();
  });

  test('GET /api/assessments should return list', async () => {
    const res = await request(app)
      .get('/api/assessments')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.assessments)).toBe(true);
  });
});
```

## Deployment

### Docker

Add a `Dockerfile` to the server root:

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t student-rec-api .
docker run -p 5000:5000 --env-file .env student-rec-api
```

### Heroku/Platform-as-a-Service

1. Set environment variables in your platform's dashboard
2. Ensure `Procfile` contains: `web: npm start`
3. Deploy:
   ```bash
   git push heroku main
   ```

### Linux/VPS

1. SSH into server
2. Clone repo and install dependencies
3. Use PM2 for process management:
   ```bash
   pm2 start server.js --name "student-rec-api" --instances max
   pm2 startup
   pm2 save
   ```
4. Set up reverse proxy (nginx/Apache) to forward traffic

### Environment Checklists

**Staging:**
- [ ] `NODE_ENV=staging`
- [ ] `MONGO_URI` pointing to staging database
- [ ] `FIREBASE_PROJECT_ID` from staging Firebase project
- [ ] `JWT_SECRET` randomly generated and stored in secrets manager
- [ ] `CORS_ALLOWED_ORIGINS` includes staging frontend URL

**Production:**
- [ ] `NODE_ENV=production`
- [ ] `MONGO_URI` with authentication and non-local host
- [ ] All Firebase credentials loaded from secure vault
- [ ] `JWT_SECRET` 32+ characters, stored in secrets manager
- [ ] `CORS_ALLOWED_ORIGINS` restrictively set to production domain(s) only
- [ ] `FACULTY_EMAILS` reviewed and minimal
- [ ] Database backups enabled
- [ ] Logs aggregated centrally
- [ ] Monitoring and alerts configured

## Security

### Authentication

- **Firebase Token Verification**: Server verifies `idToken` signature before issuing JWT (not just accepting client claims)
- **JWT Middleware**: All protected endpoints validate bearer token; malformed tokens return 401 not 500
- **Role-Based Access Control**: Faculty endpoints require `role: "faculty"` claim in JWT

### Data Protection

- **CORS**: Origin whitelist prevents unauthorized cross-origin requests
- **Environment Variables**: Secrets never committed; use `.env` or secrets manager
- **Database Authorization**: MongoDB credentials rotated regularly (if not using managed service)

### Best Practices

1. **Rotate Secrets Regularly**
   ```bash
   # Generate new JWT secret
   openssl rand -base64 32
   ```

2. **Monitor for Suspicious Activity**
   - Log auth failures with user email and timestamp
   - Alert on repeated 401 responses from single IP
  - Review faculty email list quarterly

3. **Rate Limiting** (recommended for production)
   ```bash
   npm install express-rate-limit
   ```

4. **Request Logging**
   ```bash
   npm install morgan
   ```

5. **Helmet Security Headers**
   ```bash
   npm install helmet
   ```

## Troubleshooting

### "Cannot find module 'firebase-admin'"

```bash
npm install firebase-admin
```

### "MongoNetworkError: connect ECONNREFUSED"

- Verify `MONGO_URI` is correct
- Ensure MongoDB is running: `mongod`
- Test connection: `mongo "your-connection-string"`

### "401 Unauthorized: Invalid token"

- Check JWT_SECRET is the same across deployments
- Verify token not expired: tokens valid for 24 hours by default
- Check Authorization header format: `Authorization: Bearer <token>`

### "Firebase credential error"

- Verify `FIREBASE_PRIVATE_KEY` has literal `\n` characters (not actual newlines)
- Example: `"-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"`
- Regenerate key in Firebase Console if in doubt

### "CORS error: Origin not allowed"

- Add current frontend URL to `CORS_ALLOWED_ORIGINS` in `.env`
- Comma-separated: `http://localhost:3000,https://app.com`
- Restart server after updating

### "Assessment recommendations not generating"

- Check student profile has skills: `GET /api/profile`
- Verify roles exist: `GET /api/faculty/roles`
- Check AI service logs for errors: `npm run dev` shows stack traces

### Still stuck?

- Check server logs: `npm run dev` for verbose output
- Check database: `mongosh` to inspect collections
- Check environment: `echo $MONGO_URI` to verify loaded config
- Check network: `curl http://localhost:5000/health` for connectivity

---

**Last Updated**: March 4, 2026  
**API Version**: 1.0  
**Node Version**: 14+
