// FriendsScreen.fixed.js
import {
  collection, doc,
  endAt,
  getDoc, getDocs, limit, onSnapshot, orderBy, query,
  startAt
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "./AuthProvider";
import { db } from "./firebase";
import { followUser, unfollowUser } from "./followers.service";

export default function FriendsScreen() {
  const { user } = useAuth();
  const [qtxt, setQtxt] = useState("");
  const [users, setUsers] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [following, setFollowing] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState("");

  // Escuchar "following" del usuario actual
  useEffect(() => {
    if (!user) return;
    const folRef = collection(db, "follows", user.uid, "following");
    const unsub = onSnapshot(folRef, (snap) => {
      const s = new Set();
      snap.forEach((d) => s.add(d.id));
      setFollowing(s);
    });
    return () => unsub();
  }, [user]);

  // Cargar usuarios recientes para explorar (hasta 50)
  useEffect(() => {
    const run = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const usersRef = collection(db, "users");
        const qy = query(usersRef, orderBy("createdAt", "desc"), limit(50));
        const res = await getDocs(qy);
        const arr = [];
        res.forEach((d) => {
          const data = d.data();
          if (data.uid !== user.uid) arr.push(data);
        });
        setUsers(arr);
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user?.uid]);

  // Buscar por @username con consulta exacta o prefix
  const runSearch = async () => {
    setErr("");
    setSearching(true);
    setSearchResults(null);
    try {
      const s = qtxt.trim().toLowerCase().replace(/^@/, "");
      if (!s) { setSearchResults(null); return; }

      // 1) Búsqueda exacta usando colección `usernames`
      const unameRef = doc(db, "usernames", s);
      const snap = await getDoc(unameRef);
      if (snap.exists()) {
        const { uid } = snap.data();
        const uref = doc(db, "users", uid);
        const usnap = await getDoc(uref);
        if (usnap.exists() && uid !== user?.uid) {
          setSearchResults([usnap.data()]);
          return;
        }
      }
      // 2) Prefix search por username (startAt/endAt)
      const usersRef = collection(db, "users");
      const qy = query(
        usersRef,
        orderBy("username"),
        startAt(s),
        endAt(s + "\uf8ff"),
        limit(25)
      );
      const res = await getDocs(qy);
      const arr = [];
      res.forEach((d) => {
        const data = d.data();
        if (data.uid !== user?.uid) arr.push(data);
      });
      setSearchResults(arr);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSearching(false);
    }
  };

  const toggleFollow = async (targetUid) => {
    if (!user) return;
    try {
      if (following.has(targetUid)) {
        await unfollowUser(user.uid, targetUid);
      } else {
        await followUser(user.uid, targetUid);
      }
    } catch (e) {
      setErr(e.message);
    }
  };

  const renderItem = ({ item }) => {
    const isFollowing = following.has(item.uid);
    return (
      <View style={styles.row}>
        <Image source={{ uri: item.avatar || `https://i.pravatar.cc/100?u=${item.uid}` }} style={styles.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.displayName || "Sin nombre"}</Text>
          <Text style={styles.sub}>@{item.username || "usuario"}</Text>
        </View>
        <TouchableOpacity style={[styles.followBtn, { backgroundColor: isFollowing ? "#7f8c8d" : "#3498db" }]} onPress={() => toggleFollow(item.uid)}>
          <Text style={{ color: "#fff", fontWeight: "bold" }}>{isFollowing ? "Siguiendo" : "Seguir"}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const data = searchResults ?? users;

  if (!user) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Text>Inicia sesión para ver y seguir amigos.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          placeholder="Buscar @usuario…"
          autoCapitalize="none"
          value={qtxt}
          onChangeText={setQtxt}
          style={styles.searchInput}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={runSearch} disabled={searching}>
          {searching ? <ActivityIndicator /> : <Text style={styles.searchBtnTxt}>Buscar</Text>}
        </TouchableOpacity>
      </View>

      {err ? <Text style={styles.error}>{err}</Text> : null}
      {loading ? <ActivityIndicator style={{ marginTop: 20 }} /> : null}

      {(!loading && data.length === 0) ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No hay usuarios aún</Text>
          <Text style={styles.emptyTxt}>Pide a tus amigos que se registren o prueba buscando por @usuario.</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(it) => it.uid}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={{ paddingVertical: 10 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  searchRow: { flexDirection: "row", marginBottom: 10 },
  searchInput: { flex: 1,marginTop:50, borderWidth: 1, borderColor: "#ddd", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  searchBtn: { marginLeft: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: "#3498db", alignItems: "center", justifyContent: "center" },
  searchBtnTxt: { color: "#fff", fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#f7f7f7", borderRadius: 12, padding: 10 },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12, backgroundColor: "#eee" },
  name: { fontSize: 16, fontWeight: "bold" },
  sub: { color: "#777", marginTop: 2 },
  followBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  error: { color: "crimson", marginTop: 6 },
  empty: { marginTop: 30, alignItems: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  emptyTxt: { color: "#666", textAlign: "center" },
});
