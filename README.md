# Student Recommendation Engine

An intelligent career path recommendation system that helps students discover suitable career paths based on their skills, interests, academic performance, and assessment results. Built with modern web technologies: React for the frontend and Node.js/Express with MongoDB for the backend.

---

## 🎯 Project Overview

This platform provides:

- **For Students**:
  - Personalized career recommendations with readiness scores
  - Profile management (skills, interests, academic info)
  - Skill assessments to validate competencies
  - Learning path recommendations by career role
  - Progress tracking and analytics

- **For Faculty**:
  - Assessment management (schedule, review, grade)
  - Career role configuration with learning tracks
  - Skill and interest management
  - Platform analytics and engagement metrics
    - Faculty dashboard for system oversight

---

## 📁 Project Structure

```
student-recommendation-engine/
├── server/                          # Backend API (Node.js/Express/MongoDB)
│   ├── README.md                    # Backend setup and API documentation
│   ├── .env.example                 # Backend environment template
│   ├── package.json                 # Backend dependencies
│   ├── server.js                    # Server entry point
│   ├── app.js                       # Express app factory
│   ├── config/                      # Database and app configuration
│   ├── controllers/                 # Route handlers
│   ├── middleware/                  # Auth, CORS, error handling
│   ├── models/                      # MongoDB schemas
│   ├── routes/                      # API endpoint definitions
│   ├── services/                    # Business logic (recommendations, analytics)
│   └── tests/                       # Integration tests
│
├── client/                          # Frontend SPA (React)
│   ├── README.md                    # Frontend setup and deployment guide
│   ├── .env.example                 # Frontend environment template
│   ├── package.json                 # Frontend dependencies
│   ├── public/                      # Static assets
│   └── src/
│       ├── App.js                   # Main component with routing
│       ├── firebase.js              # Firebase initialization
│       ├── components/              # Reusable UI components
│       ├── pages/                   # Full page components (student/faculty)
│       ├── routes/                  # Route protection guards
│       ├── services/                # API client (Axios)
│       └── setupTests.js
│
├── package.json                     # Root package (if monorepo setup)
├── .env.example                     # Root environment reference
├── QUICK_START.md                   # Quick start guide
├── AI_FEATURES_UPDATE.md            # AI capabilities documentation
├── BACKEND_API.md                   # Backend API reference
└── README.md                        # This file
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v14+ (v16+ recommended)
- **MongoDB** v4.4+ (local or Atlas)
- **Firebase Account** (for authentication)
- **npm** or **yarn**

### 1️⃣ Clone Repository

```bash
git clone <repository-url>
cd student-recommendation-engine
```

### 2️⃣ Backend Setup

```bash
cd server

# Copy environment template
cp .env.example .env

# Edit .env with your credentials (see server/README.md for details)
# Required:
# - MONGO_URI
# - FIREBASE_* credentials
# - JWT_SECRET
# - CORS_ALLOWED_ORIGINS
# - FACULTY_EMAILS

# Install dependencies
npm install

# Start development server
npm run dev
# Server runs on http://localhost:5000
```

**Backend is ready when you see:**
```
Server running on http://localhost:5000
✅ Connected to MongoDB
```

### 3️⃣ Frontend Setup

```bash
cd ../client

# Copy environment template
cp .env.example .env

# Edit .env with Firebase and backend URL
# Required:
# - REACT_APP_FIREBASE_* (from Firebase Console)
# - REACT_APP_API_URL=http://localhost:5000/api

# Install dependencies
npm install

# Start development server
npm start
# App opens on http://localhost:3000
```

**Frontend is ready when:**
- Browser automatically opens to http://localhost:3000
- Dashboard shows with Google sign-in button

### 4️⃣ Test the System

1. **Sign in as Student**:
   - Click "Sign in with Google"
   - Use any Google account
   - Complete profile (skills, interests, academic info)
   - View recommendations and assessments

2. **Sign in as Faculty** (if faculty email):
    - Use faculty email when signing in
    - Access `/faculty/dashboard` and `/faculty/datasets`
   - Create roles, skills, schedule assessments

---

## 🔧 Configuration Details

### Backend (.env)

See [server/README.md - Configuration](server/README.md#configuration) for comprehensive setup:

```env
# Required
MONGO_URI=mongodb://...
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="..."
JWT_SECRET=... (use: openssl rand -base64 32)
CORS_ALLOWED_ORIGINS=http://localhost:3000,...
FACULTY_EMAILS=faculty@example.com,...

# Optional
PORT=5000
NODE_ENV=development
```

### Frontend (.env)

See [client/README.md - Configuration](client/README.md#configuration) for details:

```env
# Firebase Web SDK (from Firebase Console)
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...
REACT_APP_FIREBASE_MEASUREMENT_ID=...

# Backend URL
REACT_APP_API_URL=http://localhost:5000/api
```

---

## 📚 Architecture Highlights

### Authentication Flow

```
User (Google OAuth)
    ↓
Client [firebase.js] → Firebase → idToken
    ↓
Backend [authRoutes] → verifyFirebaseToken() → JWT Issued
    ↓
Client Stores JWT → Sends in Authorization header
    ↓
Protected Routes [authMiddleware] → Validates JWT → Grants access
```

### Data Flow

```
Student Profile → Assessments → Skill Confidence
                                  ↓
                            AI Recommendation Service
                                  ↓
                              Top 3 Roles
                                  ↓
                              Faculty Dashboard
                                  ↓
                            Analytics Service
                                  ↓
                            Engagement Metrics
```

### Backwards Compatibility

The backend gracefully handles both legacy and current database schemas:

- **Recommendation flags**: `selected` OR `isSelected`
- **Readiness fields**: `matchPercentage` OR `readinessIndex`
- **User ID fields**: `userId` OR `studentId`
- **Assessment skills**: `skillId` OR `skillName`

This allows **zero-downtime deployments** on production with mixed legacy/current data.

---

## 🛠️ Development Guide

### Running Services

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm start
```

**Terminal 3 - MongoDB (if local):**
```bash
mongod
```

### Making Changes

#### Backend Changes
1. Edit file in `/server/src` or `/server/services`
2. Server hot-reloads automatically (nodemon)
3. Check `/server/README.md` for API structure

#### Frontend Changes
1. Edit file in `/client/src`
2. Browser hot-reloads automatically
3. Check `/client/README.md` for component structure

### Running Tests

**Backend:**
```bash
cd server
npm test
```

**Frontend:**
```bash
cd client
npm test
```

---

## 🚀 Deployment

### Prerequisites for Production

- [ ] All environment variables set (no hardcoded secrets)
- [ ] Database backups configured
- [ ] CORS origins restricted (not `*`)
- [ ] JWT_SECRET strong (32+ chars) and rotated
- [ ] Monitoring/logging aggregated
- [ ] Rate limiting enabled
- [ ] HTTPS enforced

### Deploy Backend

See [server/README.md - Deployment](server/README.md#deployment):

- **Heroku**: Git push, env vars in dashboard
- **Docker**: Build image, push to registry
- **Linux/VPS**: PM2 for process management
- **AWS/GCP**: Cloud Run, App Engine, or EC2

### Deploy Frontend

See [client/README.md - Deployment](client/README.md#deployment):

- **Vercel** (recommended): Connect GitHub, auto-deploy
- **Netlify**: Connect GitHub, build settings auto-configured
- **Firebase Hosting**: `firebase deploy`
- **Docker**: Nginx + static build

### Example: Vercel + Backend on Heroku

```bash
# Backend on Heroku
heroku create student-rec-api
heroku config:set MONGO_URI=... JWT_SECRET=... etc
git push heroku main

# Frontend on Vercel
vercel --prod
# Set REACT_APP_API_URL=https://student-rec-api.herokuapp.com/api
```

---

## 🔐 Security Best Practices

### Environment Secrets
- Never commit `.env` files (use `.env.example`)
- Use secrets manager (AWS Secrets Manager, Vault, Doppler)
- Rotate `JWT_SECRET` quarterly
- Regenerate Firebase credentials annually

### CORS Configuration
```env
# ❌ Never do this:
CORS_ALLOWED_ORIGINS=*

# ✅ Always restrict to specific origins:
CORS_ALLOWED_ORIGINS=https://app.yourdomain.com,https://faculty.yourdomain.com
```

### Database Access
- Use MongoDB Atlas IP whitelist
- Enable authentication on MongoDB
- Encrypt data in transit (TLS)
- Regular backups

### Request Validation
- User input validated on backend
- File uploads scanned for malware
- Rate limiting on sensitive endpoints
- HTTPS enforced

---

## 📖 Key Documentation

| Document | Purpose |
|----------|---------|
| [server/README.md](server/README.md) | Backend API setup, config, database models, services, deployment |
| [client/README.md](client/README.md) | Frontend setup, Firebase config, routing, components, deployment |
| [BACKEND_API.md](BACKEND_API.md) | Complete API endpoint reference |
| [AI_FEATURES_UPDATE.md](AI_FEATURES_UPDATE.md) | AI recommendation capabilities |
| [QUICK_START.md](QUICK_START.md) | Getting started guide |

---

## 🆘 Troubleshooting

### Connection Issues

**Backend won't start:**
```bash
# Check MongoDB is running
mongod --version

# Check port 5000 is not in use
lsof -i :5000

# Check environment variables loaded
npm run dev
```

**Frontend won't connect to backend:**
```bash
# Verify backend running on correct port
curl http://localhost:5000/health

# Check REACT_APP_API_URL in .env
cat client/.env

# Check CORS_ALLOWED_ORIGINS includes frontend origin
cat server/.env
```

### Authentication Issues

**"Firebase config is required":**
- Check `client/.env` has all `REACT_APP_FIREBASE_*` vars
- Verify Firebase project exists and web app is registered

**"401 Unauthorized":**
- Backend can't verify Firebase token
- Check `server/.env` has correct Firebase credentials
- Check Firebase project matches client config

**"CORS error":**
- Add frontend URL to `CORS_ALLOWED_ORIGINS` in `server/.env`
- Restart backend: `npm run dev`

### Database Issues

**"Cannot find module 'mongoose'":**
```bash
cd server && npm install mongoose
```

**"MongoNetworkError":**
- Verify `MONGO_URI` in `server/.env` is correct
- Check MongoDB is running
- Verify network/firewall if remote database

### Build Issues

**Frontend build fails:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## 📝 Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes following code style
3. Test locally: `npm test`
4. Commit: `git commit -m "Clear description of change"`
5. Push: `git push origin feature/your-feature`
6. Create pull request with description

---

## 📞 Support

For issues:
1. Check relevant README (server/ or client/)
2. Check Troubleshooting section above
3. Review error logs: `npm run dev` shows detailed stack traces
4. Check browser console: `F12` → Console tab
5. Check Firebase Console for auth/project errors

---

## 📄 License

[Add your license information here]

---

## 🙏 Acknowledgments

Built with:
- React & Next.js
- Node.js & Express
- MongoDB & Mongoose
- Firebase
- Bootstrap

---

**Last Updated**: March 4, 2026  
**Version**: 1.0  
**Status**: Production Ready
