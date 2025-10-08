// FriendsScreen.searchOnly.js
import { collection, doc, endAt, getDoc, getDocs, limit, orderBy, query, startAt } from "firebase/firestore";
import { useState } from "react";
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "./AuthProvider";
import { db } from "./firebase";
import { followUser, unfollowUser } from "./followers.service";

export default function FriendsScreen() {
  const { user } = useAuth();
  const [qtxt, setQtxt] = useState("");
  const [results, setResults] = useState([]);
  const [following, setFollowing] = useState(new Set()); // opcional: podrías suscribirte si quieres estado en vivo
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState("");

  const runSearch = async () => {
    setErr("");
    setResults([]);
    const s = qtxt.trim().toLowerCase().replace(/^@/, "");
    if (!s) return;
    setSearching(true);
    try {
      // 1) Username exacto via colección "usernames"
      const unameRef = doc(db, "usernames", s);
      const exact = await getDoc(unameRef);
      const out = [];
      if (exact.exists()) {
        const uid = exact.data()?.uid;
        if (uid && uid !== user?.uid) {
          const uref = doc(db, "users", uid);
          const usnap = await getDoc(uref);
          if (usnap.exists()) out.push(usnap.data());
        }
      }
      // 2) Prefix search por username
      const usersRef = collection(db, "users");
      const qy = query(
        usersRef,
        orderBy("username"),
        startAt(s),
        endAt(s + "\uf8ff"),
        limit(25)
      );
      const res = await getDocs(qy);
      res.forEach((d) => {
        const data = d.data();
        if (data.uid !== user?.uid && !out.find(x => x.uid === data.uid)) out.push(data);
      });
      setResults(out);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSearching(false);
    }
  };

  const toggleFollow = async (targetUid) => {
    if (!user || !targetUid) return;
    try {
      if (following.has(targetUid)) {
        await unfollowUser(user.uid, targetUid);
        const next = new Set(Array.from(following)); next.delete(targetUid); setFollowing(next);
      } else {
        await followUser(user.uid, targetUid);
        const next = new Set(Array.from(following)); next.add(targetUid); setFollowing(next);
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

  if (!user) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Text>Inicia sesión para buscar amigos.</Text>
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
          onSubmitEditing={runSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={runSearch} disabled={searching}>
          {searching ? <ActivityIndicator /> : <Text style={styles.searchBtnTxt}>Buscar</Text>}
        </TouchableOpacity>
      </View>
      {err ? <Text style={styles.error}>{err}</Text> : null}

      {results.length === 0 && !searching ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Busca por @usuario</Text>
          <Text style={styles.emptyTxt}>No se listan usuarios por defecto. Escribe un nombre de usuario y toca “Buscar”.</Text>
        </View>
      ) : (
        <FlatList
          data={results}
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
  container: { flex: 1, padding: 16, backgroundColor: "#fff"  },
  searchRow: { flexDirection: "row", marginBottom: 10, marginTop: 70 },
  searchInput: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
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
