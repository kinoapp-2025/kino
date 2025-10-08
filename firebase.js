// firebase.js
// Rellena con tus credenciales de Firebase (Proyecto -> Configuración -> tus apps -> "Configurar SDK")
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ⬇️ Rellena esto
const firebaseConfig = {
  apiKey: "AIzaSyD_bjQaL8fo1B9cuMeDOZJqDU8jbdloh0Q",
  authDomain: "kino-68caf.firebaseapp.com",
  databaseURL: "https://kino-68caf-default-rtdb.firebaseio.com",
  projectId: "kino-68caf",
  storageBucket: "kino-68caf.firebasestorage.app",
  messagingSenderId: "413499718007",
  appId: "1:413499718007:web:69161f0778de7ac23e4972",
  measurementId: "G-YNRRFGC5CC"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
