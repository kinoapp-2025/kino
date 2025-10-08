import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Swiper from "react-native-deck-swiper";

const { width, height } = Dimensions.get("window");
const API_KEY = "9fe143b324cff98a21169801db177a79";
const LANGUAGE = "es-ES";
const REGION = "ES";

// Storage keys
const WATCH_KEY   = "WATCHLIST_ITEMS_V1";
const FILTERS_KEY = "HOME_FILTERS_V1";
const ONBOARD_KEY = "HAS_SEEN_HOME_FILTERS_V1";
const LIKED_KEY   = "LIKED_ITEMS_V1";     // Me gustó
const PREFS_KEY   = "USER_PREFS_V1";      // Perfil (géneros aprendidos)
const HIDDEN_KEY  = "HIDDEN_ITEMS_V1";    // Nunca volver a mostrar
const PREFS_MIGRATED_KEY = "USER_PREFS_MIGRATED_V1"; // Backfill hecho

// ======= Parámetros de aprendizaje =======
const DECAY_HALF_LIFE_DAYS = 90; // a los 90 días el peso se reduce a la mitad
const MIN_SCORE_TO_KEEP = 0.1;   // umbral para limpiar géneros residuales

// ======= Helpers de perfil (aprendizaje por géneros) =======
const nowMs = () => Date.now();

const readPrefs = async () => {
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  return raw ? JSON.parse(raw) : { genreScores: {}, lastDecay: nowMs() };
};

const writePrefs = (prefs) => AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));

/** Decae pesos si ha pasado tiempo */
const decayPrefsIfNeeded = async () => {
  const prefs = await readPrefs();
  const last = prefs.lastDecay || nowMs();
  const days = (nowMs() - last) / 86400000;
  if (days < 1) return; // evita tocar cada inicio si no ha pasado al menos 1 día

  const lambda = Math.log(2) / DECAY_HALF_LIFE_DAYS;
  const factor = Math.exp(-lambda * days);

  const out = {};
  for (const [gid, score] of Object.entries(prefs.genreScores || {})) {
    const decayed = score * factor;
    if (decayed >= MIN_SCORE_TO_KEEP) out[gid] = decayed;
  }
  prefs.genreScores = out;
  prefs.lastDecay = nowMs();
  await writePrefs(prefs);
};

/** Ajusta puntuación de géneros con delta (+1 like, -1 dislike -> clamp ≥ 0) */
const adjustPrefsWithGenres = async (genreIds = [], delta = 1) => {
  if (!genreIds?.length) return;
  await decayPrefsIfNeeded(); // aplica decay antes de tocar valores

  const prefs = await readPrefs();
  prefs.genreScores = prefs.genreScores || {};
  for (const gid of genreIds) {
    const key = String(gid);
    const next = (prefs.genreScores[key] || 0) + delta;
    prefs.genreScores[key] = Math.max(0, next); // no permitir negativo
  }
  prefs.lastDecay = nowMs();
  await writePrefs(prefs);
};

/** Top N géneros aprendidos (tras aplicar decay) */
const getPreferredGenres = async (topN = 3) => {
  await decayPrefsIfNeeded();
  const prefs = await readPrefs();
  const entries = Object.entries(prefs.genreScores || {}).filter(([, s]) => s > 0);
  if (!entries.length) return [];
  entries.sort((a, b) => b[1] - a[1]); // desc
  return entries.slice(0, topN).map(([gid]) => Number(gid));
};

/** Devuelve genre_ids; si faltan, pide detalle a TMDb */
const fetchItemGenreIds = async (item) => {
  if (Array.isArray(item.genre_ids) && item.genre_ids.length) return item.genre_ids;

  const isMovie = !!item.title;
  const kind = isMovie ? "movie" : "tv";
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/${kind}/${item.id}?api_key=${API_KEY}&language=${LANGUAGE}`
    );
    const data = await res.json();
    const genres = Array.isArray(data?.genres) ? data.genres : [];
    return genres.map((g) => g.id);
  } catch (e) {
    console.warn("No se pudieron obtener géneros de detalle", e);
    return [];
  }
};

/** Backfill: aprende de todos los LIKED existentes (una sola vez) */
const backfillPrefsFromLiked = async () => {
  try {
    const migrated = await AsyncStorage.getItem(PREFS_MIGRATED_KEY);
    if (migrated) return; // ya hecho

    const raw = await AsyncStorage.getItem(LIKED_KEY);
    const liked = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(liked) || liked.length === 0) {
      await AsyncStorage.setItem(PREFS_MIGRATED_KEY, "1");
      return;
    }

    // Limita para no gastar demasiadas llamadas (ajusta si quieres)
    const MAX = 80;
    const slice = liked.slice(0, MAX);

    for (const it of slice) {
      const gids = await fetchItemGenreIds(it);
      if (gids.length) {
        await adjustPrefsWithGenres(gids, +1);
      }
    }

    await AsyncStorage.setItem(PREFS_MIGRATED_KEY, "1");
    console.log("Backfill de gustos completado");
  } catch (e) {
    console.warn("Backfill prefs error:", e);
  }
};

// Chip
const Chip = ({ label, selected, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: selected ? "#1abc9c" : "#ddd",
      backgroundColor: selected ? "#eafaf7" : "#fff",
      margin: 6,
    }}
  >
    <Text style={{ fontWeight: "600", color: selected ? "#0f866e" : "#333" }}>
      {label}
    </Text>
  </TouchableOpacity>
);

export default function HomeScreen({ navigation }) {
  // Estado inicial
  const [hydrating, setHydrating] = useState(true);

  // Filtros / UI
  const [filterMode, setFilterMode] = useState(true); // modo filtros o mazo
  const [type, setType] = useState("movie"); // "all" | "movie" | "tv"
  const [genres, setGenres] = useState([]);
  const [providers, setProviders] = useState([]);
  const [selGenres, setSelGenres] = useState([]);
  const [selProviders, setSelProviders] = useState([]);

  // Lista para swiper
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [items, setItems] = useState([]);
  const [cardIndex, setCardIndex] = useState(0);

  const swiperRef = useRef(null);

  // dedupe / ocultos
  const enqueued = useRef(new Set()); // `${__type}-${id}` ya en items
  const hiddenRef = useRef(new Set()); // ids ocultos persistidos

  // Header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: !filterMode
        ? () => (
            <TouchableOpacity
              onPress={() => setFilterMode(true)}
              style={{
                marginRight: 12,
                paddingHorizontal: 10,
                paddingVertical: 6,
                backgroundColor: "#3498db",
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>Filtros</Text>
            </TouchableOpacity>
          )
        : undefined,
      title: filterMode ? "Filtrar" : "Descubrir",
    });
  }, [navigation, filterMode]);

  /* =========================
   *  Catálogos (géneros / providers)
   * ========================= */
  const loadCatalogs = async (kind) => {
    const useKind = kind === "all" ? "movie" : kind;
    setLoadingFilters(true);
    try {
      const gRes = await fetch(
        `https://api.themoviedb.org/3/genre/${useKind}/list?api_key=${API_KEY}&language=${LANGUAGE}`
      );
      const gData = await res.json();
    } catch {}
  };

  // (Reescribimos con manejo correcto de errores)
  const loadCatalogsSafe = async (kind) => {
    const useKind = kind === "all" ? "movie" : kind;
    setLoadingFilters(true);
    try {
      const gRes = await fetch(
        `https://api.themoviedb.org/3/genre/${useKind}/list?api_key=${API_KEY}&language=${LANGUAGE}`
      );
      const gData = await gRes.json();
      setGenres(gData?.genres || []);

      const pRes = await fetch(
        `https://api.themoviedb.org/3/watch/providers/${useKind}?api_key=${API_KEY}&language=${LANGUAGE}&watch_region=${REGION}`
      );
      const pData = await pRes.json();
      let provs = Array.isArray(pData?.results) ? pData.results : [];
      provs.sort(
        (a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999)
      );
      setProviders(provs.slice(0, 40));
    } catch (e) {
      console.error("Error catálogos:", e);
      setGenres([]);
      setProviders([]);
    } finally {
      setLoadingFilters(false);
    }
  };

  /* =========================
   *  Discover aleatorio & “infinite”
   * ========================= */
  const buildDiscoverUrl = (kind, { gIds, pIds, page }) => {
    const base = `https://api.themoviedb.org/3/discover/${kind}?api_key=${API_KEY}&language=${LANGUAGE}`;
    const sort = `&sort_by=popularity.desc`;
    const regionParam = kind === "movie" ? `&region=${REGION}` : "";
    const genresParam = gIds?.length
      ? `&with_genres=${encodeURIComponent(gIds.join(","))}`
      : "";
    const provParam = pIds?.length
      ? `&with_watch_providers=${encodeURIComponent(
          pIds.join("|")
        )}&watch_region=${REGION}`
      : `&watch_region=${REGION}`;
    const monetization = `&with_watch_monetization_types=flatrate|ads|free`;
    const pageParam = `&page=${page}`;
    const voteCountMin = `&vote_count.gte=5`;
    return `${base}${sort}${regionParam}${genresParam}${provParam}${monetization}${voteCountMin}${pageParam}`;
  };

  const fetchPage = async (kind, opts) => {
    const url = buildDiscoverUrl(kind, opts);
    const res = await fetch(url);
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    return {
      results: results.map((r) => ({ ...r, __type: kind })),
      total_pages: Math.min(data?.total_pages || 1, 500),
    };
  };

  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  let maxPagesCache = { movie: 500, tv: 500 };

  const fetchRandomBatch = async (kind, { gIds, pIds }, pagesToLoad = 3) => {
    // 1) page 1 para saber total_pages con filtros vigentes
    const head = await fetchPage(kind, { gIds, pIds, page: 1 });
    maxPagesCache[kind] = head.total_pages;

    const out = [];
    const seenLocal = new Set();

    const pushFiltered = (list) => {
      for (const it of list) {
        if (!it.poster_path) continue;
        const key = `${it.__type}-${it.id}`;
        if (enqueued.current.has(key) || seenLocal.has(key)) continue;
        if (hiddenRef.current.has(key)) continue; // no volver a mostrar
        seenLocal.add(key);
        out.push(it);
      }
    };

    pushFiltered(head.results);

    // 2) páginas aleatorias extra
    for (let n = 0; n < pagesToLoad - 1; n++) {
      const randPage =
        Math.floor(Math.random() * maxPagesCache[kind]) + 1; // 1..max
      const { results } = await fetchPage(kind, { gIds, pIds, page: randPage });
      pushFiltered(results);
    }

    return shuffle(out);
  };

  /** Géneros efectivos: filtros del usuario o top aprendidos */
  const getEffectiveGenres = async (explicitGenreIds) => {
    if (explicitGenreIds?.length) return explicitGenreIds;
    const learned = await getPreferredGenres(3);
    return learned;
  };

  const fetchList = async (kind, gIds, pIds) => {
    setLoadingList(true);
    setCardIndex(0);
    enqueued.current.clear();

    try {
      const effectiveGenres = await getEffectiveGenres(gIds);

      let batch = [];
      if (kind === "all") {
        const [bm, bt] = await Promise.all([
          fetchRandomBatch("movie", { gIds: effectiveGenres, pIds }, 3),
          fetchRandomBatch("tv",    { gIds: effectiveGenres, pIds }, 3),
        ]);

        // intercalar para variedad
        const mix = [];
        const max = Math.max(bm.length, bt.length);
        for (let i = 0; i < max; i++) {
          if (bm[i]) mix.push(bm[i]);
          if (bt[i]) mix.push(bt[i]);
        }
        batch = mix;
      } else {
        batch = await fetchRandomBatch(kind, { gIds: effectiveGenres, pIds }, 5);
      }

      batch.forEach((it) => enqueued.current.add(`${it.__type}-${it.id}`));
      setItems(batch);
    } catch (e) {
      console.error("Error random discover:", e);
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  };

  // Reposición automática cuando queden pocas cartas
  const REFILL_THRESHOLD = 10;
  const REFILL_PAGES = 3;

  const refillIfNeeded = async () => {
    const remaining = items.length - cardIndex;
    if (remaining > REFILL_THRESHOLD) return;

    try {
      const effectiveGenres = await getEffectiveGenres(selGenres);

      let addition = [];
      if (type === "all") {
        const [bm, bt] = await Promise.all([
          fetchRandomBatch("movie", { gIds: effectiveGenres, pIds: selProviders }, REFILL_PAGES),
          fetchRandomBatch("tv",    { gIds: effectiveGenres, pIds: selProviders }, REFILL_PAGES),
        ]);
        const mix = [];
        const max = Math.max(bm.length, bt.length);
        for (let i = 0; i < max; i++) {
          if (bm[i]) mix.push(bm[i]);
          if (bt[i]) mix.push(bt[i]);
        }
        addition = mix;
      } else {
        addition = await fetchRandomBatch(
          type,
          { gIds: effectiveGenres, pIds: selProviders },
          REFILL_PAGES
        );
      }

      if (addition.length) {
        addition.forEach((it) =>
          enqueued.current.add(`${it.__type}-${it.id}`)
        );
        setItems((prev) => [...prev, ...addition]);
      }
    } catch (e) {
      console.error("refill error:", e);
    }
  };

  /* =========================
   *  Hidratación inicial
   * ========================= */
  useEffect(() => {
    (async () => {
      try {
        // Cargar ocultos persistidos
        const hiddenRaw = await AsyncStorage.getItem(HIDDEN_KEY);
        if (hiddenRaw) {
          const arr = JSON.parse(hiddenRaw);
          if (Array.isArray(arr)) hiddenRef.current = new Set(arr);
        }

        // Filtros guardados
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

        // Catálogos + aprendizaje histórico
        await loadCatalogsSafe(initialType);
        await backfillPrefsFromLiked();  // ⬅️ APRENDE de “Me gustó” antiguos

        const seen = await AsyncStorage.getItem(ONBOARD_KEY);
        if (seen) {
          setFilterMode(false);
          await fetchList(initialType, initialGenres, initialProviders);
        } else {
          setFilterMode(true);
        }
      } finally {
        setHydrating(false);
      }
    })();
  }, []);

  // Al cambiar tipo dentro de filtros recarga catálogos
  useEffect(() => {
    if (!filterMode) return;
    loadCatalogsSafe(type);
  }, [type, filterMode]);

  // Persistir filtros
  const persistFilters = async () => {
    await AsyncStorage.setItem(
      FILTERS_KEY,
      JSON.stringify({ type, selGenres, selProviders })
    );
  };

  // Aplicar filtros
  const applyFilters = async () => {
    await persistFilters();
    await AsyncStorage.setItem(ONBOARD_KEY, "1");
    setFilterMode(false);
    await fetchList(type, selGenres, selProviders);
  };

  const clearFilters = () => {
    setSelGenres([]);
    setSelProviders([]);
  };

  /* =========================
   *  Helpers de listas
   * ========================= */
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
      ts: Date.now(),
    };
    const current = await load(WATCH_KEY);
    if (!current.some((x) => x.id === entry.id && x.type === entry.type)) {
      await save(WATCH_KEY, [entry, ...current]);
      Alert.alert("Añadida", `"${entry.title}" añadida a Quiero ver`);
    }
    await hidePermanently(item); // no reaparece
  };

  const addToLiked = async (item) => {
    const entry = {
      id: item.id,
      title: item.title || item.name,
      poster_path: item.poster_path || null,
      type: item.title ? "movie" : "tv",
      ts: Date.now(),
    };
    const current = await load(LIKED_KEY);
    if (!current.some((x) => x.id === entry.id && x.type === entry.type)) {
      await save(LIKED_KEY, [entry, ...current]);
    }
  };

  // Ocultar y persistir que no reaparezca
  const hidePermanently = async (item) => {
    const t = item.title ? "movie" : "tv";
    const key = `${t}-${item.id}`;
    if (!hiddenRef.current.has(key)) {
      hiddenRef.current.add(key);
      await AsyncStorage.setItem(HIDDEN_KEY, JSON.stringify([...hiddenRef.current]));
    }
    // quitar carta actual del mazo
    setItems((prev) => prev.filter((it) => !(it.id === item.id && it.__type === t)));
    // si quedan poquitas, repón
    if (prevLengthAfterRemove(prev => prev.length) < 5) {
      // noop helper, ver nota abajo
    }
  };

  // helper local para saber longitud "prev" tras setState (solución simple: usar items.length directamente)
  const prevLengthAfterRemove = (fn) => items.length - 1;

  /* =========================
   *  “Ya la he visto” (aprende + penaliza + oculta)
   * ========================= */
  const onSeenPress = (item) => {
    const title = item.title || item.name || "este título";
    Alert.alert(
      "¿Te gustó?",
      `Has visto “${title}”. ¿Te gustó?`,
      [
        {
          text: "No",
          onPress: async () => {
            const genres = await fetchItemGenreIds(item);
            if (genres.length) await adjustPrefsWithGenres(genres, -1); // penaliza
            await hidePermanently(item);
            if (items.length - cardIndex < 5) await refillIfNeeded();
            Alert.alert("Anotado", "No volverá a aparecer.");
          },
        },
        {
          text: "Sí",
          onPress: async () => {
            await addToLiked(item);
            const likedGenres = await fetchItemGenreIds(item);
            if (likedGenres.length) await adjustPrefsWithGenres(likedGenres, +1); // premia
            await hidePermanently(item);
            if (items.length - cardIndex < 5) await refillIfNeeded();
            Alert.alert("Guardado ❤️", "Mejoraremos tus recomendaciones y no se repetirá.");
          },
        },
        { text: "Cancelar", style: "cancel" },
      ],
      { cancelable: true }
    );
  };

  /* =========================
   *  Tarjeta
   * ========================= */
  const renderCard = (item) => {
    if (!item) return null;
    const isMovie = !!item.title;
    const title = item.title || item.name;
    const year =
      (isMovie ? item.release_date : item.first_air_date)?.slice(0, 4) || "";

    return (
      <View style={styles.card}>
        {item.poster_path ? (
          <Image
            source={{
              uri: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
            }}
            style={styles.image}
          />
        ) : (
          <View style={[styles.image, styles.noImage]}>
            <Text>Sin imagen</Text>
          </View>
        )}

        {/* Título + badge */}
        <View style={styles.titleWrap}>
          <Text style={styles.typeBadge}>
            {isMovie ? "Película" : "Serie"}
            {year ? ` • ${year}` : ""}
          </Text>
          <Text numberOfLines={2} style={styles.titlePretty}>
            {title}
          </Text>
        </View>

        {/* Acciones */}
        <View style={styles.buttonsRow}>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => navigation.navigate("Detalle", { item })}
          >
            <Text style={styles.btnText}>ℹ Info</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btn}
            onPress={() =>
              navigation.navigate("Detalle", { item, showTrailer: true })
            }
          >
            <Text style={styles.btnText}>▶ Trailer</Text>
          </TouchableOpacity>
        </View>

        {/* Ya la he visto */}
        <TouchableOpacity style={styles.seenBtn} onPress={() => onSeenPress(item)}>
          <Text style={styles.seenText}>👀 Ya la he visto</Text>
        </TouchableOpacity>
      </View>
    );
  };

  /* =========================
   *  Render
   * ========================= */
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
      <ScrollView
        style={styles.filterContainer}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <Text style={styles.h1}>Filtra tu contenido</Text>

        <Text style={styles.h2}>Tipo</Text>
        <View style={{ flexDirection: "row", marginVertical: 6 }}>
          <Chip
            label="Todo"
            selected={type === "all"}
            onPress={() => setType("all")}
          />
          <Chip
            label="Película"
            selected={type === "movie"}
            onPress={() => setType("movie")}
          />
          <Chip
            label="Serie"
            selected={type === "tv"}
            onPress={() => setType("tv")}
          />
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
                    setSelGenres((prev) =>
                      selected
                        ? prev.filter((id) => id !== g.id)
                        : [...prev, g.id]
                    )
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
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}
          >
            {providers.map((p) => {
              const selected = selProviders.includes(p.provider_id);
              return (
                <TouchableOpacity
                  key={p.provider_id}
                  onPress={() =>
                    setSelProviders((prev) =>
                      selected
                        ? prev.filter((id) => id !== p.provider_id)
                        : [...prev, p.provider_id]
                    )
                  }
                  style={{
                    borderWidth: 1,
                    borderColor: selected ? "#1abc9c" : "#eee",
                    backgroundColor: selected ? "#eafaf7" : "#fff",
                    borderRadius: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
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
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#27ae60" }]}
            onPress={applyFilters}
          >
            <Text style={styles.actionText}>Aplicar filtros</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#7f8c8d" }]}
            onPress={clearFilters}
          >
            <Text style={styles.actionText}>Limpiar</Text>
          </TouchableOpacity>
        </View>

        <Text style={{ color: "#777", marginTop: 10 }}>
          Los filtros se guardan para la próxima vez. Puedes cambiarlos desde el
          botón “Filtros”.
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
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#3498db", marginTop: 12 }]}
          onPress={() => setFilterMode(true)}
        >
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
  cardIndex={cardIndex}
  renderCard={renderCard}
  keyExtractor={(card) => `${card.id}-${card.title ? "movie" : "tv"}`}
  backgroundColor="#fafafaa7"
  stackSize={3}
  stackScale={10}
  stackSeparation={12}
  verticalSwipe={false}
  disableTopSwipe
  disableBottomSwipe
  animateCardOpacity

  onSwiped={(idx) => {
    setCardIndex(idx + 1);
    refillIfNeeded();
  }}

  // 👉 Swipe a la derecha: Quiero ver (+0.5 interés)
  onSwipedRight={async (idx) => {
    const item = items[idx];
    if (!item) return;
    const gids = await fetchItemGenreIds(item);
    if (gids.length) await adjustPrefsWithGenres(gids, 0.5); // interés leve
    await addToWatchlist(item);
    await hidePermanently(item);
    if (items.length - cardIndex < 5) await refillIfNeeded();
  }}

  // 👉 Swipe a la izquierda: No me gustó (-1)
  onSwipedLeft={async (idx) => {
    const item = items[idx];
    if (!item) return;
    const gids = await fetchItemGenreIds(item);
    if (gids.length) await adjustPrefsWithGenres(gids, -1); // penaliza géneros
    await hidePermanently(item);
    if (items.length - cardIndex < 5) await refillIfNeeded();
  }}

  overlayLabels={{
    left: {
      title: "NOPE",
      style: { label: { color: "#c0392b", fontSize: 22, fontWeight: "900" } },
    },
    right: {
      title: "LIKE",
      style: { label: { color: "#27ae60", fontSize: 22, fontWeight: "900" } },
    },
  }}
  cardStyle={{ borderRadius: 10 }}
/>
    </View>
  );
}

/* =========================
 *  Estilos
 * ========================= */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eee", marginTop: -30 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },

  filterContainer: { flex: 1, backgroundColor: "#fff", padding: 16 },
  h1: { fontSize: 22, fontWeight: "800", marginBottom: 12 },
  h2: { fontSize: 16, fontWeight: "700", marginTop: 10, marginBottom: 4 },

  card: {
    width: width - 60,
    height: height * 0.78,
    backgroundColor: "#fffbfeff",
    borderRadius: 20,
    alignSelf: "center",
    padding: 10,
    alignItems: "center",
  },
  image: {
    width: width - 80,
    height: height * 0.57,
    borderRadius: 20,
    resizeMode: "cover",
  },
  noImage: { backgroundColor: "#ccc", justifyContent: "center", alignItems: "center" },

  titleWrap: {
    width: width - 80,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255, 255, 255, 0)",
    borderRadius: 14,
  },
  typeBadge: {
    alignSelf: "flex-start",
    color: "#000000ff",
    fontWeight: "800",
    fontSize: 10,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  titlePretty: {
    color: "#000000ff",
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 26,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  buttonsRow: { flexDirection: "row", marginTop: 12, gap: 12 },
  btn: {
    backgroundColor: "rgba(52, 59, 59, 0.25)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnText: { color: "#fff", fontWeight: "bold" },

  // “Ya la he visto”
  seenBtn: {
    marginTop: 10,
    backgroundColor: "#d9d8deff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: "stretch",
    alignItems: "center",
  },
  seenText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  actionBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    marginRight: 8,
  },
  actionText: { color: "#fff", fontWeight: "700" },
});
