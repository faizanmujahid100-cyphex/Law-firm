"use client";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

function app() {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!key || !/^AIza[\w-]{35}$/.test(key) || !process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    throw new Error("Firebase sign-in is not configured. Set the Firebase web configuration in the hosting environment and redeploy, or enable DEMO_MODE for a proposal preview.");
  }
  return getApps().length ? getApp() : initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  });
}

export const browserAuth = () => getAuth(app());
