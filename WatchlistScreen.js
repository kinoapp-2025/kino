import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const WATCH_KEY = "WATCHLIST_ITEMS_V1";

export default function WatchlistScreen({ navigation }) {
  const [data, setData] = useState([]);

  const load = async () => {
    const raw = await AsyncStorage.getItem(WATCH_KEY);
    setData(raw ? JSON.parse(raw) : []);
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const clearAll = async () => {
    Alert.alert("Borrar", "¿Vaciar tu lista 'Quiero ver' (likes)?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Eliminar", style: "destructive", onPress: async () => {
        await AsyncStorage.setItem(WATCH_KEY, JSON.stringify([]));
        setData([]);
      } }
    ]);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigation.navigate("Detalle", { item: { id: item.id, poster_path: item.poster_path, title: item.title, name: item.title } })}
    >
      {item.poster_path ? (
        <Image source={{ uri: `https://image.tmdb.org/t/p/w200${item.poster_path}` }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}><Text>Sin imagen</Text></View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.meta}>{item.type === "movie" ? "Película" : "Serie"}</Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Quiero ver (likes)</Text>
        {data.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
            <Text style={{ color: "#fff", fontWeight: "bold" }}>Borrar todo</Text>
          </TouchableOpacity>
        )}
      </View>

      {data.length === 0 ? (
        <Text style={{ textAlign: "center", marginTop: 20 }}>Tu lista está vacía. Añade deslizando a la derecha en “Descubrir”.</Text>
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
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  header: { fontSize: 22, fontWeight: "bold" },
  clearBtn: { backgroundColor: "#e74c3c", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#f7f7f7", borderRadius: 12, padding: 10 },
  thumb: { width: 70, height: 100, borderRadius: 8, marginRight: 12 },
  thumbFallback: { backgroundColor: "#ccc", justifyContent: "center", alignItems: "center" },
  title: { fontSize: 16, fontWeight: "bold" },
  meta: { marginTop: 4, color: "#666" },
  chev: { fontSize: 26, color: "#999", paddingHorizontal: 6 },
});
