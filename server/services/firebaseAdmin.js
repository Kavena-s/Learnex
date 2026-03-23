const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

function getPrivateKey() {
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!rawPrivateKey) return null;
  return rawPrivateKey.replace(/\\n/g, "\n");
}

function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return getAuth();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  // For development without Firebase credentials
  if (!projectId || !clientEmail || !privateKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  Firebase Admin credentials missing - using mock auth (development only)');
      return null; // Return null to indicate mock mode
    }
    throw new Error(
      "Firebase Admin credentials are missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
    );
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  return getAuth();
}

async function verifyFirebaseToken(idToken) {
  try {
    const auth = initializeFirebaseAdmin();
    if (!auth) {
      // Mock mode for development without credentials
      console.warn('📝 Firebase not initialized - using mock token verification');
      return {
        email: 'test@example.com',
        aud: 'student-recommendation-engine',
      };
    }
    const decodedToken = await auth.verifyIdToken(idToken, true);
    return decodedToken;
  } catch (err) {
    console.error('🔴 Firebase Token Verification Error:', err.message);
    console.error('   Full Error:', err);
    throw err;
  }
}

module.exports = {
  verifyFirebaseToken,
};
