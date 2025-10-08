// migrateLocalToCloud.js
// Migra LIKED_ITEMS_V1 y WATCHLIST_ITEMS_V1 (AsyncStorage) a Firestore por usuario.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, writeBatch } from "firebase/firestore";
import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "./AuthProvider";
import { db } from "./firebase";

const WATCH_KEY = "WATCHLIST_ITEMS_V1";
const LIKED_KEY = "LIKED_ITEMS_V1";

// Genera un ID de documento estable para no duplicar en la nube
const makeDocId = (it) => {
  const type = it.type || (it.title ? "movie" : "tv"); // por si falta
  return `${type}_${it.id}`;
};

// Normaliza payload para Firestore (con algunos campos útiles)
const toCloudItem = (it) => {
  const type = it.type || (it.title ? "movie" : "tv");
  return {
    id: it.id,
    type,
    title: it.title || it.name || "",
    poster_path: it.poster_path || "",
    backdrop_path: it.backdrop_path || "",
    vote_average: it.vote_average ?? null,
    createdAt: Date.now(), // cliente; opcionalmente podrías usar serverTimestamp en writes individuales
  };
};

export async function migrateListsForUser(uid, { likedOnly = false, watchOnly = false } = {}) {
  if (!uid) throw new Error("Falta uid para migración");

  // Leer datos locales
  const likedRaw = await AsyncStorage.getItem(LIKED_KEY);
  const watchRaw = await AsyncStorage.getItem(WATCH_KEY);
  const liked = likedOnly ? (likedRaw ? JSON.parse(likedRaw) : []) : (!watchOnly ? (likedRaw ? JSON.parse(likedRaw) : []) : []);
  const watch = watchOnly ? (watchRaw ? JSON.parse(watchRaw) : []) : (!likedOnly ? (watchRaw ? JSON.parse(watchRaw) : []) : []);

  // Preparar batch
  const batch = writeBatch(db);
  let toWrite = 0;

  // Liked -> likes/{uid}/items/{docId}
  for (const it of Array.isArray(liked) ? liked : []) {
    const did = makeDocId(it);
    const ref = doc(db, "likes", uid, "items", did);
    // Idempotente: si ya existe, no vuelves a escribir (evita costos/contención)
    // getDoc por item sería costoso; mejor escribe con merge sin pisar createdAt existente
    batch.set(ref, toCloudItem(it), { merge: true });
    toWrite++;
  }
  // Watchlist -> watchlists/{uid}/items/{docId}
  for (const it of Array.isArray(watch) ? watch : []) {
    const did = makeDocId(it);
    const ref = doc(db, "watchlists", uid, "items", did);
    batch.set(ref, toCloudItem(it), { merge: true });
    toWrite++;
  }

  if (toWrite === 0) {
    return { written: 0, likedCount: liked.length || 0, watchCount: watch.length || 0 };
  }

  await batch.commit();
  return { written: toWrite, likedCount: liked.length || 0, watchCount: watch.length || 0 };
}

// Pequeña pantalla UI para lanzar la migración manualmente
export default function MigrateScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const run = async () => {
    setError("");
    setResult(null);
    if (!user) {
      setError("Inicia sesión para migrar tus datos.");
      return;
    }
    setLoading(true);
    try {
      const r = await migrateListsForUser(user.uid);
      setResult(r);
      Alert.alert("Migración completa", `Escritos: ${r.written}\nFavoritos: ${r.likedCount}\nPendientes: ${r.watchCount}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Migrar listas a la nube</Text>
      <Text style={styles.p}>
        Esto subirá tus <Text style={styles.bold}>Favoritos</Text> y <Text style={styles.bold}>Pendientes</Text> desde tu dispositivo
        a Firestore para que estén sincronizados entre dispositivos.
      </Text>
      {!user ? <Text style={styles.warn}>Necesitas iniciar sesión.</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.btn} onPress={run} disabled={loading || !user}>
        {loading ? <ActivityIndicator /> : <Text style={styles.btnTxt}>Migrar ahora</Text>}
      </TouchableOpacity>
      {result ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Resultado</Text>
          <Text>Escritos: {result.written}</Text>
          <Text>Favoritos locales: {result.likedCount}</Text>
          <Text>Pendientes locales: {result.watchCount}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  p: { color: "#444", marginBottom: 14 },
  bold: { fontWeight: "700" },
  warn: { color: "#8e44ad", marginBottom: 8 },
  error: { color: "crimson", marginBottom: 8 },
  btn: { backgroundColor: "#2ecc71", padding: 14, borderRadius: 10, alignItems: "center" },
  btnTxt: { color: "#fff", fontWeight: "700" },
  card: { marginTop: 16, padding: 14, borderRadius: 10, backgroundColor: "#f7f7f7", borderWidth: StyleSheet.hairlineWidth, borderColor: "#eee" },
  cardTitle: { fontWeight: "700", marginBottom: 6 },
});
