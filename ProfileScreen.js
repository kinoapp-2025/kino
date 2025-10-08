// ProfileScreen estilo IG con contadores de followers
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { collection, getDocs, limit, onSnapshot, query, where } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "./AuthProvider";
import { db } from "./firebase";

const { width } = Dimensions.get("window");
const WATCH_KEY = "WATCHLIST_ITEMS_V1";
const LIKED_KEY = "LIKED_ITEMS_V1";

function GridItem({ item, onPress }) {
  const uri = item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null;
  const size = (width - 4) / 3;
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={() => onPress?.(item)} style={{ width: size, height: size, backgroundColor: "#eee" }}>
      {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} /> : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#888" }}>Sin imagen</Text></View>}
    </TouchableOpacity>
  );
}

function SectionHeader({ title }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

export default function ProfileScreenIGFollowers() {
  const { user, profile } = useAuth();
  const navigation = useNavigation();

  const [liked, setLiked] = useState([]);
  const [watch, setWatch] = useState([]);

  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    // Following -> trae perfiles
    const unsubA = onSnapshot(collection(db, "follows", user.uid, "following"), async (snap) => {
      const ids = []; snap.forEach((d) => ids.push(d.id));
      await fetchUsers(ids, setFollowing);
    });
    // Followers -> trae perfiles
    const unsubB = onSnapshot(collection(db, "followers", user.uid, "by"), async (snap) => {
      const ids = []; snap.forEach((d) => ids.push(d.id));
      await fetchUsers(ids, setFollowers);
    });
    return () => { unsubA(); unsubB(); };
  }, [user?.uid]);

  const fetchUsers = async (ids, setter) => {
    try {
      if (!ids?.length) { setter([]); return; }
      const usersRef = collection(db, "users");
      const slice = ids.slice(0, 12);
      const qUsers = query(usersRef, where("uid", "in", slice), limit(12));
      const res = await getDocs(qUsers);
      const arr = []; res.forEach((d) => arr.push(d.data()));
      setter(arr);
    } catch {
      setter([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    (async () => {
      const [l, w] = await Promise.all([
        AsyncStorage.getItem(LIKED_KEY),
        AsyncStorage.getItem(WATCH_KEY),
      ]);
      setLiked(l ? JSON.parse(l) : []);
      setWatch(w ? JSON.parse(w) : []);
    })();
  }, []));

  const avatar = profile?.avatar || user?.photoURL || `https://i.pravatar.cc/200?u=${user?.uid || "guest"}`;
  const displayName = profile?.displayName || user?.displayName || "Tu nombre";
  const username = profile?.username ? `@${profile.username}` : "@usuario";

  const stats = [
    { label: "Favoritos", value: liked.length },
    { label: "Pendientes", value: watch.length },
    { label: "Siguiendo", value: following.length },
    { label: "Seguidores", value: followers.length },
  ];

  const Row = ({ data }) => (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={data}
      keyExtractor={(it) => it.uid}
      contentContainerStyle={{ paddingHorizontal: 12 }}
      ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
      renderItem={({ item }) => (
        <View style={styles.friendCard}>
          <Image source={{ uri: item.avatar || `https://i.pravatar.cc/100?u=${item.uid}` }} style={styles.friendAvatar} />
          <Text style={styles.friendName} numberOfLines={1}>{item.displayName || "Sin nombre"}</Text>
          <Text style={styles.friendUser} numberOfLines={1}>@{item.username || "usuario"}</Text>
        </View>
      )}
    />
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#fff" }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.username}>{username}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate("Editar perfil")}>
          <Text style={styles.editTxt}>Editar perfil</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        {stats.map((s) => (
          <View key={s.label} style={styles.statBox}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <SectionHeader title="Seguidores" />
      {loading ? <ActivityIndicator style={{ marginVertical: 10 }} /> : <Row data={followers} />}

      <SectionHeader title="Siguiendo" />
      {loading ? <ActivityIndicator style={{ marginVertical: 10 }} /> : <Row data={following} />}

      <SectionHeader title="Tus favoritos" />
      <View style={styles.gridWrap}>
        <FlatList
          data={liked}
          numColumns={3}
          keyExtractor={(it, idx) => `${it.id}-${idx}`}
          renderItem={({ item }) => <GridItem item={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
          columnWrapperStyle={{ gap: 2 }}
          scrollEnabled={false}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#eee" },
  name: { fontSize: 20, fontWeight: "700" },
  username: { color: "#777", marginTop: 2 },
  editBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: "#f0f0f0" },
  editTxt: { fontWeight: "600" },
  statsRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#eee" },
  statBox: { alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "700" },
  statLabel: { color: "#777", marginTop: 2 },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  friendCard: { width: 110, backgroundColor: "#fafafa", borderRadius: 12, padding: 10, alignItems: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: "#eee" },
  friendAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#eee" },
  friendName: { marginTop: 8, fontWeight: "600" },
  friendUser: { color: "#777", fontSize: 12 },
  gridWrap: { paddingHorizontal: 2, marginBottom: 10 },
});
