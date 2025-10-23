import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDi_8uK4Jk1GZJtnlWniGuJ8-0J29vzuCE",
  authDomain: "splitsync-7b24f.firebaseapp.com",
  projectId: "splitsync-7b24f",
  storageBucket: "splitsync-7b24f.firebasestorage.app",
  messagingSenderId: "623601431427",
  appId: "1:623601431427:web:2f16dda73841e833f2bcb6",
  measurementId: "G-7HMEKKJQX7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);