# LearnEx Quick Start Guide

## 🚀 Running the Enhanced AI Platform

### Prerequisites
- Node.js (v14+)
- MongoDB (local or cloud)
- Git

### Step 1: Install Dependencies

```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### Step 2: Configure Environment

Create `server/.env`:
```env
MONGO_URI=mongodb://localhost:27017/student-recommendation
JWT_SECRET=your-secret-key-here
PORT=5000
```

### Step 3: Start Backend Server

```bash
cd server
npm start
```

Backend runs on: `http://localhost:5000`

### Step 4: Start Frontend (in new terminal)

```bash
cd client
npm start
```

Frontend runs on: `http://localhost:3000`

### Step 5: Initial Setup

1. **Create Faculty Account**
  - Register at `/login` and manually update role to 'faculty' in MongoDB
  - OR use existing faculty credentials

2. **Populate Data (Faculty Portal)**
  - Navigate to `/faculty/datasets`
   - Create Skills (e.g., JavaScript, Python, React)
   - Create Interests (e.g., Web Development, Data Science)
   - Create Roles with required skills

3. **Test Student Flow**
   - Register as student
   - Complete profile at `/profile`
   - Generate recommendations at `/home`
   - Select a role
   - View AI readiness at `/dashboard`
   - Take adaptive assessment

4. **View Analytics (Faculty)**
  - Navigate to `/faculty/analytics`
   - View comprehensive platform insights

---

## 📊 Testing the New Features

### 1. AI-Powered Recommendations
```bash
# Student logs in → completes profile → clicks "Generate Recommendations"
# System returns top 3 roles with readiness scores
```

### 2. Adaptive Assessments
```bash
# From Dashboard → click "Take Assessment" for a skill
# Answer 10 dynamic questions
# Submit to get adaptive recommendation:
#   - Score ≥80%: Level up
#   - Score 60-79%: Continue
#   - Score <60%: Revise with learning materials
```

### 3. Learning Materials
```bash
# After failed assessment, system shows learning resources
# OR manually access: GET /api/profile/learning-materials
```

### 4. Faculty Analytics
```bash
# Faculty → Analytics tab
# View 5 tabs:
#   - Overview: Key metrics
#   - Domains: Most popular roles
#   - Skills: Skill gap trends
#   - Assessments: Pass/fail ratios
#   - Engagement: Student participation
```

---

## 🧪 API Testing with Postman/cURL

### Get AI Readiness Analysis
```bash
curl -X GET http://localhost:5000/api/recommend/readiness \
  -H "Authorization: Bearer <student-token>"
```

### Start Adaptive Assessment
```bash
curl -X POST http://localhost:5000/api/assessments/start \
  -H "Authorization: Bearer <student-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "skillName": "JavaScript",
    "level": "beginner"
  }'
```

### Submit Assessment
```bash
curl -X POST http://localhost:5000/api/assessments/<assessment-id>/submit \
  -H "Authorization: Bearer <student-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [0, 2, 1, 3, 0, 1, 2, 0, 3, 1]
  }'
```

### Get Faculty Analytics
```bash
curl -X GET http://localhost:5000/api/faculty/analytics \
  -H "Authorization: Bearer <faculty-token>"
```

---

## 🎯 Expected Behavior

### Student Dashboard
- Shows circular AI readiness indicator
- Displays skill confidence breakdown
- Shows improvement plan
- Color-coded readiness status

### Home Page
- Shows recommendation cards when generated
- "Select" button sets selected role
- Shows "Selected on [date]" after selection
- Redirects to dashboard after 2 seconds

### Assessment Flow
1. Student starts assessment → 10 dynamic questions generated
2. 30-minute timer starts
3. Student submits answers
4. System analyzes performance:
   - Overall score
   - Weak concepts identified
   - Adaptive recommendation provided
   - Learning materials suggested if needed
5. If score ≥80%, student's skill level increases

### Faculty Analytics
- Real-time metrics refresh on button click
- Tabbed interface for different metric categories
- Visual charts and progress bars
- Tables for detailed data

---

## 🐛 Troubleshooting

**Backend won't start**
- Check MongoDB is running: `mongod`
- Verify .env file exists with correct connection string

**Frontend build errors**
- Clear cache: `rm -rf node_modules package-lock.json && npm install`
- Check React version compatibility

**No recommendations showing**
- Ensure roles have required skills defined
- Verify student profile has skills added
- Check console for API errors

**Assessment questions not generating**
- Verify skill name matches template key (case-insensitive)
- Check questionGenerationService.js for available templates
- Add custom templates if needed

**Analytics loading forever**
- Check faculty has correct role in database
- Verify token is valid
- Check backend analytics service for errors

---

## 📋 Sample Data Setup (MongoDB Compass)

### Sample Skill
```json
{
  "skillName": "JavaScript",
  "category": "Programming Languages",
  "description": "Modern web programming language"
}
```

### Sample Interest
```json
{
  "interestName": "Web Development",
  "category": "Technology"
}
```

### Sample Role
```json
{
  "roleName": "Frontend Developer",
  "domain": "Web Development",
  "description": "Build user interfaces",
  "requiredSkills": [
    {
      "skillName": "JavaScript",
      "proficiencyLevel": "intermediate"
    },
    {
      "skillName": "React",
      "proficiencyLevel": "intermediate"
    }
  ],
  "relatedInterests": ["Web Development", "UI/UX Design"],
  "roadmap": {
    "beginner": {
      "description": "Learn HTML, CSS, JavaScript basics",
      "duration": "3 months",
      "topics": ["HTML5", "CSS3", "JavaScript ES6"]
    },
    "intermediate": {
      "description": "Learn React and modern frameworks",
      "duration": "4 months",
      "topics": ["React", "Redux", "API Integration"]
    },
    "advanced": {
      "description": "Advanced patterns and performance",
      "duration": "3 months",
      "topics": ["Design Patterns", "Performance", "Testing"]
    }
  }
}
```

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Backend running on port 5000
- [ ] Frontend running on port 3000
- [ ] MongoDB connected
- [ ] Faculty can log in
- [ ] Faculty can create skills/interests/roles
- [ ] Student can register and log in
- [ ] Student can save profile
- [ ] Student can generate recommendations
- [ ] Student can select role
- [ ] Dashboard shows AI readiness widget
- [ ] Student can start assessment
- [ ] Assessment generates 10 questions
- [ ] Assessment submits successfully
- [ ] Adaptive recommendation shows
- [ ] Learning materials provided for weak concepts
- [ ] Faculty can view analytics
- [ ] All analytics tabs load data

---

## 🎉 Success!

If all verification steps pass, your LearnEx AI-powered platform is ready!

**Next Steps:**
1. Customize question templates for your institution's skills
2. Tune recommendation weights in config
3. Add more skills, interests, and roles
4. Invite students to test
5. Monitor analytics for insights

For detailed API documentation, see: `BACKEND_API.md`  
For feature documentation, see: `AI_FEATURES_UPDATE.md`

**Happy Learning! 🚀**
