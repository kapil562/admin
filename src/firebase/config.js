import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// 1. Univo Infotech Primary Firebase (Admin Auth & Company Expenses)
const univoConfig = {
  apiKey: import.meta.env.VITE_UNIVO_API_KEY,
  authDomain: import.meta.env.VITE_UNIVO_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_UNIVO_PROJECT_ID,
  storageBucket: import.meta.env.VITE_UNIVO_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_UNIVO_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_UNIVO_APP_ID,
};

// 2. Library Software Firebase (Library Clients, Subscriptions, WhatsApp packs, Queries)
const libraryConfig = {
  apiKey: import.meta.env.VITE_LIBRARY_API_KEY,
  authDomain: import.meta.env.VITE_LIBRARY_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_LIBRARY_PROJECT_ID,
  storageBucket: import.meta.env.VITE_LIBRARY_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_LIBRARY_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_LIBRARY_APP_ID,
};

// Initialize or retrieve Univo App
const univoApp = getApps().find(app => app.name === 'univoApp') || initializeApp(univoConfig, 'univoApp');
export const univoAuth = getAuth(univoApp);
export const univoDb = getFirestore(univoApp);

// Initialize or retrieve Library App
const libraryApp = getApps().find(app => app.name === 'libraryApp') || initializeApp(libraryConfig, 'libraryApp');
export const libraryAuth = getAuth(libraryApp);
export const libraryDb = getFirestore(libraryApp);
export const libraryStorage = getStorage(libraryApp);


