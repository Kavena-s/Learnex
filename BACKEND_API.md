# LearnEx Backend API Documentation

## Authentication
All protected endpoints require a JWT token in the `Authorization` header:
```
Authorization: Bearer <JWT_TOKEN>
```

## API Endpoints

### 1. Authentication (`/api/auth`)
```
POST /api/auth/google-login
Body: { token: "firebase_id_token" }
Response: { accessToken, user: { id, email, name, role } }
```

### 2. Student Profile (`/api/profile`)

**Save/Update Profile**
```
POST /api/profile
Auth: Required
Body: {
  cgpa: 7.5,
  skills: ["skillId1", "skillId2"],
  interests: ["interestId1"],
  projectsDone: [
    { domain: "Web Development", count: 2 },
    { domain: "Mobile Dev", count: 1 }
  ]
}
Response: { message, profile }
```

**Get Profile**
```
GET /api/profile
Auth: Required
Response: { profile with populated skills, interests, selectedRole }
```

**Get Available Skills**
```
GET /api/profile/skills
Auth: Required
Response: { count, skills: [{ _id, name, category, description }] }
```

**Get Available Interests**
```
GET /api/profile/interests
Auth: Required
Response: { count, interests: [{ _id, name, description }] }
```

### 3. Recommendations (`/api/recommend`)

**Generate Recommendations**
```
POST /api/recommend
Auth: Required
Response: {
  message,
  count: 3,
  recommendations: [
    {
      _id,
      userId,
      roleId,
      roleName,
      matchPercentage: 85,
      breakdown: { cgpaScore, skillMatchScore, interestMatchScore, projectRelevanceScore },
      explanation,
      missingSkills,
      rank: 1,
      selected: false
    },
    ...
  ]
}
```

**Get Recommendations**
```
GET /api/recommend
Auth: Required
Response: { count, recommendations: [...] }
```

**Select a Role**
```
PUT /api/recommend/:recommendationId/select
Auth: Required
Response: { message, recommendation }
```

### 4. Student Assessments (`/api/assessments`)

**Request Assessment**
```
POST /api/assessments
Auth: Required
Body: { roleId, level: "beginner|intermediate|advanced" }
Response: { message, assessment }
```

**Get My Assessments**
```
GET /api/assessments
Auth: Required
Response: { count, assessments: [...] }
```

### 5. Faculty Management (`/api/faculty`)

Legacy alias: `/api/admin` remains available for backward compatibility.

#### Skills Management
```
POST /api/faculty/skills
GET /api/faculty/skills?category=Frontend
GET /api/faculty/skills/categories
GET /api/faculty/skills/:skillId
PUT /api/faculty/skills/:skillId
DELETE /api/faculty/skills/:skillId
POST /api/faculty/skills/bulk (Create multiple)
```

#### Interests Management
```
POST /api/faculty/interests
GET /api/faculty/interests
GET /api/faculty/interests/:interestId
PUT /api/faculty/interests/:interestId
DELETE /api/faculty/interests/:interestId
POST /api/faculty/interests/bulk (Create multiple)
```

#### Roles Management
```
POST /api/faculty/roles
Body: {
  roleName: "Full Stack Developer",
  description: "...",
  minCGPA: 6.5,
  minProjects: 2,
  requiredSkills: ["skillId1", "skillId2"],
  preferredSkills: ["skillId3"],
  relatedInterests: ["interestId1"],
  weights: { cgpa: 20, skillMatch: 40, interestMatch: 25, projectRelevance: 15 },
  roadmap: {
    beginner: { topics: [...], estimatedHours: 40 },
    intermediate: { topics: [...], estimatedHours: 50 },
    advanced: { topics: [...], estimatedHours: 60 }
  }
}

GET /api/faculty/roles
GET /api/faculty/roles/:roleId
PUT /api/faculty/roles/:roleId
DELETE /api/faculty/roles/:roleId
GET /api/roles/:roleId/roadmap (Student view)
```

#### Assessment Management
```
GET /api/faculty/assessments?status=requested|scheduled|completed
POST /api/faculty/assessments/:assessmentId/schedule
Body: { scheduledDate: "2024-01-15T10:00:00Z", mode: "online|offline" }

PUT /api/faculty/assessments/:assessmentId/complete
Body: { result: "passed|needs_improvement", facultyNotes: "..." }

GET /api/faculty/assessments/student/:studentId (Student assessment history)
```

## Response Format

### Success Response
```json
{
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "message": "Error description",
  "error": "Detailed error message"
}
```

## Error Codes

- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Server Error

## Scoring Algorithm

The recommendation engine uses weighted scoring:

```
Match Score = (CGPA Score × 20%) + (Skill Match × 40%) + (Interest Match × 25%) + (Project Score × 15%)

Where:
  - CGPA Score = (Student CGPA / 10) × 100
  - Skill Match = (Matched Required Skills / Total Required Skills) × 100
  - Interest Match = (Matched Interests / Total Role Interests) × 100
  - Project Score = (Student Projects / Role Min Projects) × 100 (capped at 100)
```

Top 3 recommendations are returned, ranked by match percentage.

## Assessment Workflow

1. **Student**: Submits assessment request → status: `requested`
2. **Faculty**: Schedules assessment → status: `scheduled`
3. **Faculty**: Marks result as `passed` or `needs_improvement` → status: `completed`
4. **System**: Updates student roadmap progress if passed

## User Roles

- **Student**: Access profile, recommendations, assessments
- **Faculty** (spkavena@gmail.com): Full access to all management endpoints

All faculty endpoints require faculty role verification.

## Testing with cURL

### Generate Recommendations
```bash
curl -X POST http://localhost:5000/api/recommend \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### Create a Skill
```bash
curl -X POST http://localhost:5000/api/faculty/skills \
  -H "Authorization: Bearer YOUR_FACULTY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"React","category":"Frontend","description":"JavaScript library for UI"}'
```

### Create a Role
```bash
curl -X POST http://localhost:5000/api/faculty/roles \
  -H "Authorization: Bearer YOUR_FACULTY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roleName": "Frontend Developer",
    "minCGPA": 6.5,
    "minProjects": 2,
    "requiredSkills": ["skillId1"],
    "roadmap": {
      "beginner": {"topics": ["HTML/CSS"], "estimatedHours": 40},
      "intermediate": {"topics": ["React"], "estimatedHours": 50},
      "advanced": {"topics": ["Advanced React"], "estimatedHours": 60}
    }
  }'
```

## Notes

- All timestamps are in ISO 8601 format
- CGPA must be between 0-10
- Recommendation scores are integers (0-100)
- Assessment dates must be in the future
- Skill and interest names are automatically lowercased for consistency
