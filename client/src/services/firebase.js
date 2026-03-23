import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

// Firebase configuration - Update these from your Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyB4haAPlvSY_GkBvepNOesrXAS7KrQ_Yn4",
  authDomain: "student-recommendation-engine.firebaseapp.com",
  projectId: "student-recommendation-engine",
  storageBucket: "student-recommendation-engine.firebasestorage.app",
  messagingSenderId: "370210075318",
  appId: "1:370210075318:web:e90942c2d1b6bbbe5b2c17",
  measurementId: "G-VJBM3VY7HE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Google Sign-In function
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const idToken = await user.getIdToken();
    
    return {
      email: user.email,
      name: user.displayName,
      idToken: idToken,
    };
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    throw error;
  }
};

// Sign out function
export const signOut = async () => {
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Sign Out Error:", error);
    throw error;
  }
};

