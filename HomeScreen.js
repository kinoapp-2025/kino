import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions, Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import Swiper from "react-native-deck-swiper";

const { width, height } = Dimensions.get("window");
const API_KEY = "9fe143b324cff98a21169801db177a79";
const LANGUAGE = "es-ES";
const REGION = "ES";

// Claves de storage
const WATCH_KEY   = "WATCHLIST_ITEMS_V1";
const FILTERS_KEY = "HOME_FILTERS_V1";
const ONBOARD_KEY = "HAS_SEEN_HOME_FILTERS_V1"; // ⟵ primera vez

// Chip simple
const Chip = ({ label, selected, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
      borderWidth: 1, borderColor: selected ? "#1abc9c" : "#ddd",
      backgroundColor: selected ? "#eafaf7" : "#fff", margin: 6,
    }}
  >
    <Text style={{ fontWeight: "600", color: selected ? "#0f866e" : "#333" }}>{label}</Text>
  </TouchableOpacity>
);

export default function HomeScreen({ navigation }) {
  // Estado de “arranque” para no parpadear
  const [hydrating, setHydrating] = useState(true);

  // Filtros / UI
  const [filterMode, setFilterMode] = useState(true); // se decide en el hydrate
  const [type, setType] = useState("movie"); // "movie" | "tv"
  const [genres, setGenres] = useState([]);
  const [providers, setProviders] = useState([]);
  const [selGenres, setSelGenres] = useState([]);
  const [selProviders, setSelProviders] = useState([]);

  // Lista para swiper
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [items, setItems] = useState([]);
  const swiperRef = useRef(null);

  // Header: mostrar botón “Filtros” solo cuando NO estamos en modo filtros
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: !filterMode
        ? () => (
            <TouchableOpacity
              onPress={() => setFilterMode(true)}
              style={{ marginRight: 12, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#3498db", borderRadius: 8 }}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>Filtros</Text>
            </TouchableOpacity>
          )
        : undefined,
      title: filterMode ? "Filtrar" : "Descubrir",
    });
  }, [navigation, filterMode]);

  // Cargar catálogos (géneros / proveedores) por tipo
  const loadCatalogs = async (kind) => {
    setLoadingFilters(true);
    try {
      const gRes = await fetch(`https://api.themoviedb.org/3/genre/${kind}/list?api_key=${API_KEY}&language=${LANGUAGE}`);
      const gData = await gRes.json();
      setGenres(gData?.genres || []);

      const pRes = await fetch(`https://api.themoviedb.org/3/watch/providers/${kind}?api_key=${API_KEY}&language=${LANGUAGE}&watch_region=${REGION}`);
      const pData = await pRes.json();
      let provs = Array.isArray(pData?.results) ? pData.results : [];
      provs.sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999));
      setProviders(provs.slice(0, 40));
    } catch (e) {
      console.error("Error catálogos:", e);
      setGenres([]);
      setProviders([]);
    } finally {
      setLoadingFilters(false);
    }
  };

  // Descubrir con filtros
  const fetchList = async (kind, gIds, pIds) => {
    setLoadingList(true);
    try {
      const base = `https://api.themoviedb.org/3/discover/${kind}?api_key=${API_KEY}&language=${LANGUAGE}&sort_by=popularity.desc&page=1`;
      const regionParam = kind === "movie" ? `&region=${REGION}` : "";
      const genresParam = gIds?.length ? `&with_genres=${encodeURIComponent(gIds.join(","))}` : "";
      const provParam = pIds?.length ? `&with_watch_providers=${encodeURIComponent(pIds.join("|"))}&watch_region=${REGION}` : `&watch_region=${REGION}`;
      const monetization = `&with_watch_monetization_types=flatrate|ads|free`;
      const url = `${base}${regionParam}${genresParam}${provParam}${monetization}`;

      const res = await fetch(url);
      const data = await res.json();
      const results = Array.isArray(data?.results) ? data.results : [];

      if (results.length === 0) {
        const popRes = await fetch(`https://api.themoviedb.org/3/${kind}/popular?api_key=${API_KEY}&language=${LANGUAGE}&page=1`);
        const popData = await popRes.json();
        setItems(popData?.results || []);
      } else {
        setItems(results);
      }
    } catch (e) {
      console.error("Error discover:", e);
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  };

  // Hidratación inicial:
  // - Carga filtros guardados (si hay)
  // - Ve si ya vio los filtros (ONBOARD_KEY)
  // - Si ya los vio → entra directo a swiper cargando resultados con los filtros guardados
  useEffect(() => {
    (async () => {
      try {
        // 1) filtros guardados
        let initialType = "movie";
        let initialGenres = [];
        let initialProviders = [];
        const savedRaw = await AsyncStorage.getItem(FILTERS_KEY);
        if (savedRaw) {
          const saved = JSON.parse(savedRaw);
          initialType = saved?.type || "movie";
          initialGenres = saved?.selGenres || [];
          initialProviders = saved?.selProviders || [];
          setType(initialType);
          setSelGenres(initialGenres);
          setSelProviders(initialProviders);
        }

        // 2) cargar catálogos del tipo actual
        await loadCatalogs(initialType);

        // 3) ¿ya vio filtros?
        const seen = await AsyncStorage.getItem(ONBOARD_KEY);

        if (seen) {
          // entrar directo a swiper
          setFilterMode(false);
          await fetchList(initialType, initialGenres, initialProviders);
        } else {
          // mostrar filtros la primera vez
          setFilterMode(true);
        }
      } finally {
        setHydrating(false);
      }
    })();
  }, []);

  // Si cambias el tipo dentro de filtros, recarga catálogos
  useEffect(() => {
    if (!filterMode) return; // evita recargar si estás en swiper
    loadCatalogs(type);
  }, [type, filterMode]);

  // Persistir filtros
  const persistFilters = async () => {
    await AsyncStorage.setItem(
      FILTERS_KEY,
      JSON.stringify({ type, selGenres, selProviders })
    );
  };

  // Aplicar filtros (primera vez marca ONBOARD_KEY)
  const applyFilters = async () => {
    await persistFilters();
    await AsyncStorage.setItem(ONBOARD_KEY, "1"); // ⟵ ya vio filtros

    setFilterMode(false);         // pasa a swiper
    await fetchList(type, selGenres, selProviders);
  };

  const clearFilters = () => {
    setSelGenres([]);
    setSelProviders([]);
  };

  // Watchlist (swipe derecha)
  const load = async (key) => {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  };
  const save = (key, list) => AsyncStorage.setItem(key, JSON.stringify(list));
  const addToWatchlist = async (item) => {
    const entry = {
      id: item.id,
      title: item.title || item.name,
      poster_path: item.poster_path || null,
      type: item.title ? "movie" : "tv",
    };
    const current = await load(WATCH_KEY);
    if (!current.some(x => x.id === entry.id && x.type === entry.type)) {
      await save(WATCH_KEY, [entry, ...current]);
      Alert.alert("Añadida", `"${entry.title}" añadida a Quiero ver`);
    }
  };

  // Tarjeta (SIN botón “Quiero ver”)
  const renderCard = (item) => {
    if (!item) return null;
    return (
      <View style={styles.card}>
        {item.poster_path ? (
          <Image source={{ uri: `https://image.tmdb.org/t/p/w500${item.poster_path}` }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.noImage]}><Text>Sin imagen</Text></View>
        )}
        <Text style={styles.title}>{item.title || item.name}</Text>

        <View style={styles.buttonsRow}>
          <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate("Detalle", { item })}>
            <Text style={styles.btnText}>ℹ Info</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: "#e74c3c" }]} onPress={() => navigation.navigate("Detalle", { item, showTrailer: true })}>
            <Text style={styles.btnText}>▶ Trailer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ------------ Render ------------
  if (hydrating) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
        <Text>Cargando…</Text>
      </View>
    );
  }

  if (filterMode) {
    return (
      <ScrollView style={styles.filterContainer} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text style={styles.h1}>Filtra tu contenido</Text>

        <Text style={styles.h2}>Tipo</Text>
        <View style={{ flexDirection: "row", marginVertical: 6 }}>
          <Chip label="Película" selected={type === "movie"} onPress={() => setType("movie")} />
          <Chip label="Serie"    selected={type === "tv"}    onPress={() => setType("tv")} />
        </View>

        <Text style={styles.h2}>Géneros</Text>
        {loadingFilters ? (
          <ActivityIndicator size="small" />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {genres.map((g) => {
              const selected = selGenres.includes(g.id);
              return (
                <Chip
                  key={g.id}
                  label={g.name}
                  selected={selected}
                  onPress={() =>
                    setSelGenres(prev => selected ? prev.filter(id => id !== g.id) : [...prev, g.id])
                  }
                />
              );
            })}
          </View>
        )}

        <Text style={styles.h2}>Plataformas (ES)</Text>
        {loadingFilters ? (
          <ActivityIndicator size="small" />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
            {providers.map((p) => {
              const selected = selProviders.includes(p.provider_id);
              return (
                <TouchableOpacity
                  key={p.provider_id}
                  onPress={() =>
                    setSelProviders(prev => selected ? prev.filter(id => id !== p.provider_id) : [...prev, p.provider_id])
                  }
                  style={{
                    borderWidth: 1, borderColor: selected ? "#1abc9c" : "#eee",
                    backgroundColor: selected ? "#eafaf7" : "#fff",
                    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8,
                    margin: 6,
                  }}
                >
                  <Text style={{ fontWeight: "600" }}>{p.provider_name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ flexDirection: "row", marginTop: 16 }}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#27ae60" }]} onPress={applyFilters}>
            <Text style={styles.actionText}>Aplicar filtros</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#7f8c8d" }]} onPress={clearFilters}>
            <Text style={styles.actionText}>Limpiar</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ color: "#777", marginTop: 10 }}>
          Los filtros se guardan para la próxima vez. Puedes cambiarlos desde el botón “Filtros”.
        </Text>
      </ScrollView>
    );
  }

  if (loadingList) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
        <Text>Cargando resultados…</Text>
      </View>
    );
  }

  if (!items.length) {
    return (
      <View style={styles.loader}>
        <Text>No hay resultados con esos filtros.</Text>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#3498db", marginTop: 12 }]} onPress={() => setFilterMode(true)}>
          <Text style={styles.actionText}>Volver a filtros</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Swiper
        ref={swiperRef}
        cards={items}
        renderCard={renderCard}
        keyExtractor={(card) => `${card.id}-${card.title ? "movie" : "tv"}`}
        backgroundColor="#eee"
        stackSize={3}
        stackScale={10}
        stackSeparation={12}
        verticalSwipe={false}
        disableTopSwipe
        disableBottomSwipe
        animateCardOpacity
        onSwipedRight={async (idx) => {
          const item = items[idx];
          if (item) await addToWatchlist(item); // ⟵ derecha = “Quiero ver”
        }}
        onSwipedLeft={() => {}}
        overlayLabels={{
          left:  { title: "NOPE",       style: { label: { color: "#c0392b", fontSize: 24, fontWeight: "900" } } },
          right: { title: "LIKE", style: { label: { color: "#27ae60", fontSize: 22, fontWeight: "900" } } },
        }}
        cardStyle={{ borderRadius: 20 }}
      />
    </View>
  );
}

// ----------------- styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eee", justifyContent: "center" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },

  filterContainer: { flex: 1, backgroundColor: "#fff", padding: 16 },
  h1: { fontSize: 22, fontWeight: "800", marginBottom: 12 },
  h2: { fontSize: 16, fontWeight: "700", marginTop: 10, marginBottom: 4 },

  card: {
    width: width - 60, height: height * 0.75, backgroundColor: "#fff",
    borderRadius: 20, alignSelf: "center", padding: 10, alignItems: "center",
  },
  image: { width: width - 80, height: height * 0.55, borderRadius: 20, resizeMode: "cover" },
  noImage: { backgroundColor: "#ccc", justifyContent: "center", alignItems: "center" },
  title: { marginTop: 10, fontSize: 20, fontWeight: "bold", textAlign: "center" },

  buttonsRow: { flexDirection: "row", marginTop: 10, gap: 8 },
  btn: { backgroundColor: "#3498db", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: "#fff", fontWeight: "bold" },

  actionBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, marginRight: 8 },
  actionText: { color: "#fff", fontWeight: "700" },
});
