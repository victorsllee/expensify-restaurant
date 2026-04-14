export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "expensify-restaurant.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "expensify-restaurant",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "expensify-restaurant.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "916784877279",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:916784877279:web:b632a0f4e81041f02d636a"
};