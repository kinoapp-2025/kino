// AuthProvider.js
import { onAuthStateChanged, signOut, updateProfile } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth, db } from "./firebase";

const AuthCtx = createContext({ user: null, profile: null, loading: true });
export const useAuth = () => useContext(AuthCtx);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Cargar/crear perfil
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setProfile(snap.data());
        } else {
          const data = {
            uid: u.uid,
            email: u.email || null,
            displayName: u.displayName || "",
            username: u.username || "",
            avatar: u.photoURL || "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(ref, data);
          setProfile(data);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const value = useMemo(() => ({
    user, profile, loading,
    signOut: () => signOut(auth),
    setDisplayName: async (name) => user && updateProfile(user, { displayName: name }),
  }), [user, profile, loading]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
