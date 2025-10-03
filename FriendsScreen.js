import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

const FRIENDS_KEY = "FRIENDS_FOLLOWING_V1";
const MOCK_FRIENDS = [
  { id: "1", name: "Ana Pérez", avatar: "https://i.pravatar.cc/100?img=1" },
  { id: "2", name: "Luis García", avatar: "https://i.pravatar.cc/100?img=2" },
  { id: "3", name: "María López", avatar: "https://i.pravatar.cc/100?img=3" },
  { id: "4", name: "Carlos Ruiz", avatar: "https://i.pravatar.cc/100?img=4" },
  { id: "5", name: "Sofía Díaz", avatar: "https://i.pravatar.cc/100?img=5" },
];

export default function FriendsScreen() {
  const [q, setQ] = useState("");
  const [following, setFollowing] = useState([]); // array de ids

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(FRIENDS_KEY);
      setFollowing(raw ? JSON.parse(raw) : []);
    })();
  }, []);

  const toggleFollow = async (id) => {
    const isFollowing = following.includes(id);
    const updated = isFollowing ? following.filter(x => x !== id) : [id, ...following];
    setFollowing(updated);
    await AsyncStorage.setItem(FRIENDS_KEY, JSON.stringify(updated));
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return MOCK_FRIENDS;
    return MOCK_FRIENDS.filter(f => f.name.toLowerCase().includes(s));
  }, [q]);

  const renderItem = ({ item }) => {
    const isFollowing = following.includes(item.id);
    return (
      <View style={styles.row}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.sub}>{isFollowing ? "Te sigue / Siguiéndose" : "Sugerido"}</Text>
        </View>
        <TouchableOpacity style={[styles.followBtn, { backgroundColor: isFollowing ? "#7f8c8d" : "#3498db" }]} onPress={() => toggleFollow(item.id)}>
          <Text style={{ color: "#fff", fontWeight: "bold" }}>{isFollowing ? "Siguiendo" : "Seguir"}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TextInput placeholder="Buscar amigos…" value={q} onChangeText={setQ} style={styles.search} />
      <FlatList
        data={filtered}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={{ paddingVertical: 10 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  search: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#f7f7f7", borderRadius: 12, padding: 10 },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  name: { fontSize: 16, fontWeight: "bold" },
  sub: { color: "#777", marginTop: 2 },
  followBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
});
