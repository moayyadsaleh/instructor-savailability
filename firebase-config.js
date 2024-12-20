// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCDS0kxH6_EIGyiGhcXz0fCImGTToMf9DY",
  authDomain: "instructor-s-availability.firebaseapp.com",
  projectId: "instructor-s-availability",
  storageBucket: "instructor-s-availability.firebasestorage.app",
  messagingSenderId: "97145204107",
  appId: "1:97145204107:web:a216a526b4d780658bd38e",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, addDoc, getDocs, deleteDoc, doc, onSnapshot };
