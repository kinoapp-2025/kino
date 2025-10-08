// DetailScreen.js
import Constants from "expo-constants";
import { memo, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");
const API_KEY = "9fe143b324cff98a21169801db177a79";

/* =========================
   Helpers apertura plataformas
   ========================= */
const isExpoGo = Constants.appOwnership === "expo";
const enc = (s = "") => encodeURIComponent(s);

const PROVIDERS = {
  netflix: {
    schemes: [
      (t) => `nflx://www.netflix.com/search?q=${enc(t)}`,
      () => `nflx://www.netflix.com/browse`,
    ],
    universal: (t) => `https://www.netflix.com/search?q=${enc(t)}`,
    androidPackage: "com.netflix.mediaclient",
    iosAppId: "363590051",
    homepageDomains: ["netflix.com"],
  },
  "disney+": {
    schemes: [() => `disneyplus://`],
    universal: (t) => `https://www.disneyplus.com/search?q=${enc(t)}`,
    androidPackage: "com.disney.disneyplus",
    iosAppId: "1446075923",
    homepageDomains: ["disneyplus.com"],
  },
  "amazon prime video": {
    schemes: [
      (t) => `primevideo://search?phrase=${enc(t)}`,
      () => `primevideo://`,
    ],
    universal: (t) => `https://www.primevideo.com/search?phrase=${enc(t)}`,
    androidPackage: "com.amazon.avod.thirdpartyclient",
    iosAppId: "545519333",
    homepageDomains: ["primevideo.com"],
  },
  max: {
    schemes: [() => `hbomax://`, () => `max://`],
    universal: (t) => `https://play.max.com/search?q=${enc(t)}`,
    androidPackage: "com.wbd.stream",
    iosAppId: "1556984746",
    homepageDomains: ["play.max.com"],
  },
  "apple tv+": {
    schemes: [() => `tv://`],
    universal: (t) => `https://tv.apple.com/search?term=${enc(t)}`,
    iosAppId: "1174078549",
    homepageDomains: ["tv.apple.com"],
  },
};

const tryOpen = async (url) => {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
};

const openStore = async (meta, providerName) => {
  if (Platform.OS === "android") {
    if (meta?.androidPackage) {
      const market = `market://details?id=${meta.androidPackage}`;
      const web = `https://play.google.com/store/apps/details?id=${meta.androidPackage}`;
      if (await tryOpen(market)) return;
      if (await tryOpen(web)) return;
    }
    await tryOpen(`https://play.google.com/store/search?q=${enc(providerName)}&c=apps`);
  } else {
    if (meta?.iosAppId) {
      await tryOpen(`https://apps.apple.com/app/id${meta.iosAppId}`);
      return;
    }
    await tryOpen(`https://apps.apple.com/us/search?term=${enc(providerName)}`);
  }
};

const openPlatform = async (providerName, title, homepage) => {
  const key = (providerName || "").trim().toLowerCase();
  const meta = PROVIDERS[key];
  if (!meta) {
    Alert.alert("Plataforma no soportada", providerName || "Desconocida");
    return;
  }

  if (homepage && meta.homepageDomains?.some((d) => homepage.includes(d))) {
    if (await tryOpen(homepage)) return;
  }

  const isIOS = Platform.OS === "ios";
  const preferUniversalFirst = isIOS && isExpoGo;

  const steps = [];
  if (preferUniversalFirst && meta.universal) steps.push(() => meta.universal(title || ""));
  if (Array.isArray(meta.schemes)) for (const make of meta.schemes) steps.push(() => make(title || ""));
  if (!preferUniversalFirst && meta.universal) steps.push(() => meta.universal(title || ""));

  for (const build of steps) {
    const url = build();
    if (url && (await tryOpen(url))) return;
  }

  if (isIOS && isExpoGo) {
    Alert.alert("No se pudo abrir", `Busca "${title}" en ${providerName}.`);
    return;
  }
  await openStore(meta, providerName);
};

/* =========================
   Componentes UI
   ========================= */

// Tarjeta de actor (foto redonda + nombre en negrita + personaje)
const ActorCard = memo(function ActorCard({ actor }) {
  const imgUri = actor.profile_path
    ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
    : null;
  return (
    <View style={styles.actorCard}>
      {imgUri ? (
        <Image source={{ uri: imgUri }} style={styles.actorAvatar} />
      ) : (
        <View style={[styles.actorAvatar, styles.actorAvatarFallback]}>
          <Text style={{ color: "#777" }}>No img</Text>
        </View>
      )}
      <Text numberOfLines={1} style={styles.actorName}>
        {actor.name}
      </Text>
      {!!actor.character && (
        <Text numberOfLines={2} style={styles.actorCharacter}>
          {actor.character}
        </Text>
      )}
    </View>
  );
});

/* =========================
   Pantalla de Detalle
   ========================= */

export default function DetailScreen({ route }) {
  const { item } = route.params || {};
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trailerUrl, setTrailerUrl] = useState(null);
  const [providers, setProviders] = useState([]);

  const pickTrailer = (videos) => {
    const list = Array.isArray(videos?.results) ? videos.results : [];
    const t =
      list.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official) ||
      list.find((v) => v.site === "YouTube" && v.type === "Trailer") ||
      list.find((v) => v.site === "YouTube");
    return t ? `https://www.youtube.com/watch?v=${t.key}` : null;
  };

  const toMinutesText = (min) => {
    if (!min && min !== 0) return "";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const renderStars = (vote) => {
    const full = Math.floor((vote || 0) / 2);
    const empty = 5 - full;
    return (
      <Text style={styles.stars}>
        {"★".repeat(full)}
        {"☆".repeat(empty)} <Text style={styles.starsSmall}>{Number(vote || 0).toFixed(1)}/10</Text>
      </Text>
    );
  };

  useEffect(() => {
    const fetchData = async () => {
      const type = item?.title ? "movie" : "tv";
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/${type}/${item.id}?api_key=${API_KEY}&language=es-ES&append_to_response=credits,videos`
        );
        const data = await res.json();
        setDetails(data);
        setTrailerUrl(pickTrailer(data.videos));

        const provRes = await fetch(
          `https://api.themoviedb.org/3/${type}/${item.id}/watch/providers?api_key=${API_KEY}`
        );
        const prov = await provRes.json();
        const country = prov.results?.ES ? "ES" : prov.results?.US ? "US" : null;
        const list = country ? prov.results[country] : {};
        const raw = [
          ...(list.flatrate || []),
          ...(list.free || []),
          ...(list.rent || []),
          ...(list.buy || []),
        ];
        const seen = new Set();
        const unique = raw.filter((p) => !seen.has(p.provider_id) && seen.add(p.provider_id));
        setProviders(unique);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Cargando...</Text>
      </View>
    );

  if (!details)
    return (
      <View style={styles.center}>
        <Text>No se pudieron cargar los detalles</Text>
      </View>
    );

  const isMovie = !!details.title;
  const title = details.title || details.name;
  const poster = details.poster_path ? `https://image.tmdb.org/t/p/w780${details.poster_path}` : null;
  const genres = details.genres?.map((g) => g.name).join(" • ");
  const duration = isMovie
    ? toMinutesText(details.runtime)
    : (Array.isArray(details.episode_run_time) && details.episode_run_time.length
        ? `${details.episode_run_time[0]} min/ep`
        : "");
  const crew = details.credits?.crew || [];
  const cast = details.credits?.cast || [];

  const topCast = cast.slice(0, 12); // mostramos más actores ahora
  const director = crew.find((c) => c.job === "Director");

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 28 }}>
      {/* Poster */}
      {poster ? (
        <Image source={{ uri: poster }} style={styles.poster} />
      ) : (
        <View style={[styles.poster, styles.posterFallback]}>
          <Text>Sin imagen</Text>
        </View>
      )}

      {/* Título + metadatos */}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.meta}>
        {isMovie ? "🎬 Película" : "📺 Serie"} • {genres || "Sin géneros"}{duration ? ` • ${duration}` : ""}
      </Text>

      {/* Estrellas */}
      <View style={{ paddingHorizontal: 16, marginTop: 6 }}>{renderStars(details.vote_average)}</View>

      {/* Descripción */}
      <Text style={styles.sectionTitle}>Descripción</Text>
      <Text style={styles.sectionText}>{details.overview || "Sin descripción"}</Text>

      {/* Director */}
      {isMovie && (
        <>
          <Text style={styles.sectionTitle}>Director</Text>
          <Text style={styles.sectionText}>{director?.name || "Desconocido"}</Text>
        </>
      )}

      {/* Reparto principal (carrusel) */}
      <Text style={styles.sectionTitle}>Reparto principal</Text>
      {topCast.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actorsRow}
        >
          {topCast.map((a) => (
            <ActorCard key={a.id} actor={a} />
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.sectionText}>No hay reparto disponible</Text>
      )}

      {/* Botón Trailer */}
      {trailerUrl && (
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: "#e74c3c" }]}
            onPress={() => Linking.openURL(trailerUrl)}
          >
            <Text style={styles.buttonText}>▶ Ver trailer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Plataformas */}
      {providers.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Disponible en</Text>
          <View style={styles.providersWrap}>
            {providers.map((p) => (
              <TouchableOpacity
                key={p.provider_id}
                style={styles.providerChip}
                onPress={() => openPlatform(p.provider_name, title, details.homepage)}
              >
                <Text style={styles.providerText}>{p.provider_name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

/* =========================
   Estilos
   ========================= */
const CARD_SIZE = 96;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  poster: { width, height: width * 1.5, resizeMode: "cover" },
  posterFallback: { justifyContent: "center", alignItems: "center", backgroundColor: "#eaecee" },

  // Título grande y bonito
  title: {
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 16,
    color: "#2c3e50",
    paddingHorizontal: 16,
  },
  meta: {
    fontSize: 14,
    color: "#7f8c8d",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 10,
  },

  // Secciones elegantes
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 16,
    color: "#34495e",
    borderBottomWidth: 2,
    borderBottomColor: "#ecf0f1",
    paddingBottom: 4,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  sectionText: {
    fontSize: 16,
    marginHorizontal: 16,
    marginBottom: 6,
    color: "#2c3e50",
    lineHeight: 22,
  },

  // Estrellas
  stars: { fontSize: 18, color: "#f1c40f", fontWeight: "700", textAlign: "center" },
  starsSmall: { fontSize: 14, color: "#555", fontWeight: "600" },

  // Carrusel de actores
  actorsRow: { paddingHorizontal: 12, paddingVertical: 4 },
  actorCard: {
    width: CARD_SIZE,
    alignItems: "center",
    marginHorizontal: 6,
  },
  actorAvatar: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: CARD_SIZE / 2,
    backgroundColor: "#ecf0f1",
  },
  actorAvatarFallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  actorName: {
    marginTop: 8,
    fontWeight: "bold",
    color: "#2c3e50",
    fontSize: 13,
    textAlign: "center",
  },
  actorCharacter: {
    marginTop: 2,
    color: "#7f8c8d",
    fontSize: 12,
    textAlign: "center",
  },

  // Trailer & plataformas
  row: { flexDirection: "row", justifyContent: "center", marginVertical: 16 },
  button: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  providersWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: 12,
    gap: 8,
    marginBottom: 16,
  },
  providerChip: {
    backgroundColor: "#2ecc71",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  providerText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
