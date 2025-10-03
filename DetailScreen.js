// DetailScreen.js
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

const { width } = Dimensions.get("window");
const API_KEY = "9fe143b324cff98a21169801db177a79";

export default function DetailScreen({ route }) {
  const { item, showTrailer } = route.params || {};
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trailerUrl, setTrailerUrl] = useState(null);
  const [providerButtons, setProviderButtons] = useState([]);

  const safe = (obj, path, def = undefined) => {
    try {
      return path.split(".").reduce((acc, k) => (acc ? acc[k] : undefined), obj) ?? def;
    } catch { return def; }
  };

  // —— Detecta trailer YouTube
  const pickTrailer = (videos) => {
    const list = Array.isArray(videos?.results) ? videos.results : [];
    const t = list.find(v => v.site === "YouTube" && v.type === "Trailer" && v.official)
      || list.find(v => v.site === "YouTube" && v.type === "Trailer")
      || list.find(v => v.site === "YouTube");
    return t ? `https://www.youtube.com/watch?v=${t.key}` : null;
  };

  // —— Mapa de plataformas: domains (para URL exacta), schemes (para abrir app), y IDs de tienda
  const PROVIDER_MAP = {
    netflix: {
      domains: ["netflix.com"], // si homepage incluye esto, abrimos esa URL
      schemes: ["nflx://", "netflix://"],
      androidPackage: "com.netflix.mediaclient",
      iosAppId: "363590051",
    },
    "disney+": {
      domains: ["disneyplus.com"],
      schemes: ["disneyplus://"],
      androidPackage: "com.disney.disneyplus",
      iosAppId: "1446075923",
    },
    "amazon prime video": {
      domains: ["primevideo.com", "amazon.com/gp/video"],
      schemes: ["primevideo://"],
      androidPackage: "com.amazon.avod.thirdpartyclient",
      iosAppId: "545519333",
    },
    "prime video": {
      domains: ["primevideo.com", "amazon.com/gp/video"],
      schemes: ["primevideo://"],
      androidPackage: "com.amazon.avod.thirdpartyclient",
      iosAppId: "545519333",
    },
    max: {
      domains: ["play.max.com", "hbomax.com"],
      schemes: ["hbomax://", "max://"],
      androidPackage: "com.wbd.stream",
      iosAppId: "1556984746",
    },
    "apple tv+": {
      domains: ["tv.apple.com"],
      schemes: ["tv://"],
      // iOS solamente en móviles; Android móvil no tiene Apple TV (solo Android TV)
      iosAppId: "1174078549",
    },
  };

  const normalize = (name = "") => name.trim().toLowerCase();
  const titleStr = (obj) => obj?.title || obj?.name || "";

  // —— Intenta abrir URL universal (contenido exacto) → si no, app → si no, tienda.
  const openDirectOrAppOrStore = async (providerName) => {
    const key = normalize(providerName);
    const meta = PROVIDER_MAP[key];
    const homepage = (details?.homepage || "").trim();

    // 1) Si homepage apunta al dominio de esa plataforma, abre esa URL (universal link)
    if (homepage && meta?.domains?.some(d => homepage.includes(d))) {
      try {
        await Linking.openURL(homepage);
        return;
      } catch {}
    }

    // 2) Intenta abrir la app por scheme
    if (Array.isArray(meta?.schemes)) {
      for (const scheme of meta.schemes) {
        try {
          const can = await Linking.canOpenURL(scheme);
          if (can) { await Linking.openURL(scheme); return; }
        } catch {}
      }
    }

    // 3) No está instalada → tienda
    if (Platform.OS === "android") {
      if (meta?.androidPackage) {
        const marketUrl = `market://details?id=${meta.androidPackage}`;
        const webUrl = `https://play.google.com/store/apps/details?id=${meta.androidPackage}`;
        try {
          const can = await Linking.canOpenURL(marketUrl);
          await Linking.openURL(can ? marketUrl : webUrl);
          return;
        } catch {
          await Linking.openURL(webUrl);
          return;
        }
      }
      // fallback búsqueda
      await Linking.openURL(`https://play.google.com/store/search?q=${encodeURIComponent(providerName)}&c=apps`);
      return;
    } else {
      if (meta?.iosAppId) {
        const url = `https://apps.apple.com/app/id${meta.iosAppId}`;
        await Linking.openURL(url);
        return;
      }
      await Linking.openURL(`https://apps.apple.com/us/search?term=${encodeURIComponent(providerName)}`);
      return;
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      const type = item?.title ? "movie" : "tv";
      try {
        // Detalles + videos (para homepage y trailer)
        const r = await fetch(
          `https://api.themoviedb.org/3/${type}/${item.id}?api_key=${API_KEY}&language=es-ES&append_to_response=credits,videos`
        );
        const data = await r.json();
        setDetails(data);

        const trailer = pickTrailer(data?.videos);
        setTrailerUrl(trailer);
        if (showTrailer && trailer) Linking.openURL(trailer);

        // Watch providers para construir lista de chips
        const rp = await fetch(
          `https://api.themoviedb.org/3/${type}/${item.id}/watch/providers?api_key=${API_KEY}`
        );
        const providers = await rp.json();
        const country = providers?.results?.ES ? "ES" : (providers?.results?.US ? "US" : null);
        const entry = country ? providers.results[country] : null;

        const gather = (k) => Array.isArray(entry?.[k]) ? entry[k] : [];
        const source = [...gather("flatrate"), ...gather("free"), ...gather("rent"), ...gather("buy")];

        const unique = [];
        const seen = new Set();
        for (const p of source) {
          if (!seen.has(p.provider_id)) {
            seen.add(p.provider_id);
            unique.push(p);
          }
        }

        setProviderButtons(
          unique.map(p => ({
            name: p?.provider_name || "Plataforma",
            onPress: () => openDirectOrAppOrStore(p?.provider_name || ""),
          }))
        );
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Cargando detalles…</Text>
      </View>
    );
  }

  if (!details) {
    return (
      <View style={styles.center}>
        <Text>No se pudieron cargar los detalles</Text>
      </View>
    );
  }

  const poster = details.poster_path ? `https://image.tmdb.org/t/p/w780${details.poster_path}` : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 28 }}>
      {poster ? (
        <Image source={{ uri: poster }} style={styles.poster} />
      ) : (
        <View style={[styles.poster, styles.posterFallback]}><Text>Sin imagen</Text></View>
      )}

      <Text style={styles.title}>{titleStr(details)}</Text>

      <Text style={styles.section}>Descripción</Text>
      <Text style={styles.text}>{details.overview || "Sin descripción disponible"}</Text>

      <View style={styles.row}>
        {trailerUrl && (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: "#e74c3c" }]}
            onPress={() => Linking.openURL(trailerUrl)}
          >
            <Text style={styles.buttonText}>▶ Trailer</Text>
          </TouchableOpacity>
        )}
      </View>

      {providerButtons.length > 0 && (
        <>
          <Text style={styles.section}>Disponible en</Text>
          <View style={styles.providersWrap}>
            {providerButtons.map((p, idx) => (
              <TouchableOpacity key={`${p.name}-${idx}`} style={styles.providerChip} onPress={p.onPress}>
                <Text style={styles.providerText}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  poster: { width, height: width * 1.5, resizeMode: "cover", backgroundColor: "#ddd" },
  posterFallback: { justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "800", paddingHorizontal: 16, paddingTop: 14 },
  section: { fontSize: 16, fontWeight: "700", paddingHorizontal: 16, marginTop: 18, marginBottom: 6 },
  text: { fontSize: 15, paddingHorizontal: 16, marginBottom: 4, lineHeight: 20 },
  row: { flexDirection: "row", justifyContent: "center", paddingHorizontal: 16, marginTop: 14, gap: 10 },
  button: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  providersWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingTop: 6 },
  providerChip: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#2ecc71", borderRadius: 20 },
  providerText: { color: "#fff", fontWeight: "700" },
});
