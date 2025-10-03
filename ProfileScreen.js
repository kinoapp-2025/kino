import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const API_KEY = "9fe143b324cff98a21169801db177a79";
const WATCH_KEY = "WATCHLIST_ITEMS_V1";
const FRIENDS_KEY = "FRIENDS_FOLLOWING_V1";
const MOCK_FRIENDS = [
  { id: "1", name: "Ana Pérez", avatar: "https://i.pravatar.cc/100?img=1" },
  { id: "2", name: "Luis García", avatar: "https://i.pravatar.cc/100?img=2" },
  { id: "3", name: "María López", avatar: "https://i.pravatar.cc/100?img=3" },
  { id: "4", name: "Carlos Ruiz", avatar: "https://i.pravatar.cc/100?img=4" },
  { id: "5", name: "Sofía Díaz", avatar: "https://i.pravatar.cc/100?img=5" },
];

export default function ProfileScreen({ navigation }) {
  const [recs, setRecs] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [friends, setFriends] = useState([]);

  const loadWatchlist = async () => {
    const raw = await AsyncStorage.getItem(WATCH_KEY);
    return raw ? JSON.parse(raw) : [];
  };

  const fetchRecommendationsFor = async (seed) => {
    const type = seed.type || (seed.title ? "movie" : "tv");
    const url = `https://api.themoviedb.org/3/${type}/${seed.id}/recommendations?api_key=${API_KEY}&language=es-ES&page=1`;
    const res = await fetch(url);
    const data = await res.json();
    const items = (data?.results || []).map(r => ({ ...r, _type: type }));
    return items;
  };

  const fetchRecommendations = async () => {
    setLoadingRecs(true);
    try {
      const watch = await loadWatchlist();
      let seeds = watch.slice(0, 3); // limita llamadas
      if (seeds.length === 0) {
        // fallback: populares si no hay nada en “Quiero ver”
        const res = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&language=es-ES&page=1`);
        const data = await res.json();
        setRecs(data.results || []);
        return;
      }
      const all = [];
      for (const s of seeds) {
        const r = await fetchRecommendationsFor(s);
        all.push(...r);
      }
      // dedupe por id + título/nombre
      const map = new Map();
      for (const it of all) {
        const key = `${it._type === "tv" || it.name ? "tv" : "movie"}:${it.id}`;
        if (!map.has(key)) map.set(key, it);
      }
      setRecs(Array.from(map.values()).slice(0, 30));
    } catch (e) {
      console.error(e);
      setRecs([]);
    } finally {
      setLoadingRecs(false);
    }
  };

  const loadFriends = async () => {
    const raw = await AsyncStorage.getItem(FRIENDS_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    const list = MOCK_FRIENDS.filter(f => ids.includes(f.id));
    setFriends(list);
  };

  useFocusEffect(
    useCallback(() => {
      fetchRecommendations();
      loadFriends();
    }, [])
  );

  const renderRec = ({ item }) => (
    <TouchableOpacity
      style={styles.recCard}
      onPress={() => navigation.navigate("Detalle", { item })}
    >
      {item.poster_path ? (
        <Image source={{ uri: `https://image.tmdb.org/t/p/w300${item.poster_path}` }} style={styles.recImg} />
      ) : (
        <View style={[styles.recImg, { backgroundColor: "#ccc", justifyContent: "center", alignItems: "center" }]}>
          <Text>Sin imagen</Text>
        </View>
      )}
      <Text numberOfLines={2} style={styles.recTitle}>{item.title || item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <Text style={styles.h1}>Tu perfil</Text>

      <View style={styles.block}>
        <View style={styles.blockHeader}>
          <Text style={styles.h2}>Recomendaciones para ti</Text>
          <TouchableOpacity onPress={fetchRecommendations}><Text style={styles.link}>Actualizar</Text></TouchableOpacity>
        </View>
        {loadingRecs ? (
          <ActivityIndicator size="small" />
        ) : recs.length === 0 ? (
          <Text>No hay recomendaciones aún. Añade cosas a “Quiero ver”.</Text>
        ) : (
          <FlatList
            data={recs}
            renderItem={renderRec}
            keyExtractor={(it) => `${(it.title ? "m" : "t")}-${it.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
            contentContainerStyle={{ paddingVertical: 8 }}
          />
        )}
      </View>

      <View style={styles.block}>
        <View style={styles.blockHeader}>
          <Text style={styles.h2}>Tus amigos</Text>
          <Text style={{ color: "#777" }}>{friends.length} siguiendo</Text>
        </View>
        {friends.length === 0 ? (
          <Text>No sigues a nadie todavía. Ve a la pestaña “Amigos” para empezar a seguir.</Text>
        ) : (
          <View style={{ gap: 12 }}>
            {friends.map(f => (
              <View key={f.id} style={styles.friendRow}>
                <Image source={{ uri: f.avatar }} style={styles.friendAvatar} />
                <Text style={styles.friendName}>{f.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  h1: { fontSize: 24, fontWeight: "800", marginBottom: 12 },
  h2: { fontSize: 18, fontWeight: "700" },
  link: { color: "#3498db", fontWeight: "600" },
  block: { marginTop: 10 },
  blockHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  recCard: { width: 140 },
  recImg: { width: 140, height: 200, borderRadius: 12 },
  recTitle: { marginTop: 6, fontSize: 14, fontWeight: "600" },
  friendRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#f7f7f7", padding: 10, borderRadius: 12 },
  friendAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  friendName: { fontSize: 16, fontWeight: "600" },
});
