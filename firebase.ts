import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
    apiKey: "AIzaSyCYAVtqtxU2xKuP7-DYSFa0o9E2lL0Lw2M",
    authDomain: "chat-app-5c9d2.firebaseapp.com",
    projectId: "chat-app-5c9d2",
    storageBucket: "chat-app-5c9d2.firebasestorage.app",
    messagingSenderId: "1071862760597",
    appId: "1:1071862760597:web:1b3a8d3c7cc6e1c6e6479c",
    measurementId: "G-LLVZMV60N4"
  };

const app = initializeApp(firebaseConfig);

// ใช้ AsyncStorage เพื่อเก็บข้อมูล authentication state
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export const db: Firestore = getFirestore(app);
export const storage = getStorage(app);