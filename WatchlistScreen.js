import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const WATCH_KEY = "WATCHLIST_ITEMS_V1";   // Pendientes
const LIKED_KEY = "LIKED_ITEMS_V1";       // Me gustó

export default function WatchlistScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState("watch"); // "watch" | "liked"
  const [watchData, setWatchData] = useState([]);
  const [likedData, setLikedData] = useState([]);

  const load = async (key) => {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  };

  const save = (key, list) => AsyncStorage.setItem(key, JSON.stringify(list));

  const loadAll = async () => {
    const [w, l] = await Promise.all([load(WATCH_KEY), load(LIKED_KEY)]);
    setWatchData(Array.isArray(w) ? w : []);
    setLikedData(Array.isArray(l) ? l : []);
  };

  useFocusEffect(useCallback(() => { loadAll(); }, []));

  const clearAll = async () => {
    const isWatch = activeTab === "watch";
    const title = isWatch ? "Pendientes de ver" : "Me gustó";
    Alert.alert("Borrar", `¿Vaciar tu lista “${title}”?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          if (isWatch) {
            await save(WATCH_KEY, []);
            setWatchData([]);
          } else {
            await save(LIKED_KEY, []);
            setLikedData([]);
          }
        },
      },
    ]);
  };

  const removeOne = async (item) => {
    if (activeTab === "watch") {
      const next = watchData.filter((x) => !(x.id === item.id && x.type === item.type));
      setWatchData(next);
      await save(WATCH_KEY, next);
    } else {
      const next = likedData.filter((x) => !(x.id === item.id && x.type === item.type));
      setLikedData(next);
      await save(LIKED_KEY, next);
    }
  };

  const data = activeTab === "watch" ? watchData : likedData;
  const headerTitle = activeTab === "watch" ? "Pendientes de ver" : "Me gustó";

  const goToDetail = (item) => {
    // En tu storage guardaste "title" con el nombre visible.
    // Para Detalle, TMDB usa title (pelis) o name (series).
    const navItem =
      item.type === "movie"
        ? { id: item.id, poster_path: item.poster_path, title: item.title }
        : { id: item.id, poster_path: item.poster_path, name: item.title };
    navigation.navigate("Detalle", { item: navItem });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.row} onPress={() => goToDetail(item)} activeOpacity={0.85}>
      {item.poster_path ? (
        <Image
          source={{ uri: `https://image.tmdb.org/t/p/w200${item.poster_path}` }}
          style={styles.thumb}
        />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Text>Sin imagen</Text>
        </View>
      )}

      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.meta}>{item.type === "movie" ? "Película" : "Serie"}</Text>
      </View>

      <TouchableOpacity style={styles.removeBtn} onPress={() => removeOne(item)}>
        <Text style={styles.removeTxt}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "watch" && styles.tabActive]}
          onPress={() => setActiveTab("watch")}
        >
          <Text style={[styles.tabText, activeTab === "watch" && styles.tabTextActive]}>
            Pendientes de ver
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "liked" && styles.tabActive]}
          onPress={() => setActiveTab("liked")}
        >
          <Text style={[styles.tabText, activeTab === "liked" && styles.tabTextActive]}>
            Me gustó
          </Text>
        </TouchableOpacity>
      </View>

      {/* Header + borrar todo */}
      <View style={styles.headerRow}>
        <Text style={styles.header}>{headerTitle}</Text>
        {data.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
            <Text style={{ color: "#fff", fontWeight: "bold" }}>Borrar todo</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Lista */}
      {data.length === 0 ? (
        <View style={{ padding: 20 }}>
          <Text style={{ textAlign: "center", color: "#666" }}>
            {activeTab === "watch"
              ? "Tu lista está vacía. Añade deslizando a la derecha en “Descubrir”."
              : "Aún no has marcado nada como “Me gustó”."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(it) => `${it.id}-${it.type}`}
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

  tabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#eef1f4",
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: "#2ecc71",
  },
  tabText: { fontWeight: "800", color: "#445" },
  tabTextActive: { color: "#fff" },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  header: { fontSize: 22, fontWeight: "bold" },
  clearBtn: {
    backgroundColor: "#e74c3c",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f7f7f7",
    borderRadius: 12,
    padding: 10,
  },
  thumb: { width: 70, height: 100, borderRadius: 8, marginRight: 12 },
  thumbFallback: { backgroundColor: "#ccc", justifyContent: "center", alignItems: "center" },

  title: { fontSize: 16, fontWeight: "bold" },
  meta: { marginTop: 4, color: "#666" },

  removeBtn: {
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  removeTxt: { color: "#fff", fontWeight: "900", fontSize: 14 },
});
