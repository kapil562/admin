import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// 1. Univo Infotech Firebase (Expenses, Core Admin)
const univoConfig = {
  apiKey: import.meta.env.VITE_UNIVO_API_KEY || 'mock-api-key',
  authDomain: import.meta.env.VITE_UNIVO_AUTH_DOMAIN || 'mock-auth-domain',
  projectId: import.meta.env.VITE_UNIVO_PROJECT_ID || 'mock-project-id',
  storageBucket: import.meta.env.VITE_UNIVO_STORAGE_BUCKET || 'mock-storage-bucket',
  messagingSenderId: import.meta.env.VITE_UNIVO_MESSAGING_SENDER_ID || 'mock-sender-id',
  appId: import.meta.env.VITE_UNIVO_APP_ID || 'mock-app-id',
};

// 2. Library App Firebase (Library Owners, Queries)
const libraryConfig = {
  apiKey: import.meta.env.VITE_LIBRARY_API_KEY || 'mock-api-key-lib',
  authDomain: import.meta.env.VITE_LIBRARY_AUTH_DOMAIN || 'mock-auth-domain-lib',
  projectId: import.meta.env.VITE_LIBRARY_PROJECT_ID || 'mock-project-id-lib',
  storageBucket: import.meta.env.VITE_LIBRARY_STORAGE_BUCKET || 'mock-storage-bucket-lib',
  messagingSenderId: import.meta.env.VITE_LIBRARY_MESSAGING_SENDER_ID || 'mock-sender-id-lib',
  appId: import.meta.env.VITE_LIBRARY_APP_ID || 'mock-app-id-lib',
};

// Initialize Primary (Univo)
const univoApp = initializeApp(univoConfig, 'univoApp');
export const univoAuth = getAuth(univoApp);
export const univoDb = getFirestore(univoApp);

// Initialize Secondary (Library)
const libraryApp = initializeApp(libraryConfig, 'libraryApp');
export const libraryDb = getFirestore(libraryApp);
