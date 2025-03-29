// firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
    apiKey: "AIzaSyCYAVtqtxU2xKuP7-DYSFa0o9E2lL0Lw2M",
    authDomain: "chat-app-5c9d2.firebaseapp.com",
    projectId: "chat-app-5c9d2",
    storageBucket: "chat-app-5c9d2.appspot.com",
    messagingSenderId: "1071862760597",
    appId: "1:1071862760597:web:1b3a8d3c7cc6e1c6e6479c",
    measurementId: "G-LLVZMV60N4"
};

// Initialize Firebase app if not already initialized
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp(); // If already initialized, use that one
}

// Initialize auth with AsyncStorage for persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export const db = getFirestore(app);
export const storage = getStorage(app);