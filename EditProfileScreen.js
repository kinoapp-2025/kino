// EditProfileScreen con subida de avatar a Storage
import * as ImagePicker from "expo-image-picker";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { useState } from "react";
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "./AuthProvider";
import { db } from "./firebase";

const storage = getStorage();

export default function EditProfileScreen({ navigation }) {
  const { user, profile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [avatar, setAvatar] = useState(profile?.avatar || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const pickAndUpload = async () => {
    setErr("");
    // pedir permisos
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Permiso requerido", "Necesitamos acceso a tu galería para seleccionar un avatar.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (res.canceled) return;
    const asset = res.assets[0];
    const response = await fetch(asset.uri);
    const blob = await response.blob();

    const mime = blob.type || "image/jpeg";
    // Validación local básica
    if (!/^image\//.test(mime)) {
      Alert.alert("Archivo no válido", "Selecciona una imagen.");
      return;
    }
    if (blob.size > 5 * 1024 * 1024) {
      Alert.alert("Imagen muy grande", "Máximo 5 MB.");
      return;
    }
    try {
      setUploading(true);
      const ext = mime.includes("png") ? "png" : "jpg";
      const path = `avatars/${user.uid}.${ext}`;
      const r = ref(storage, path);
      await uploadBytes(r, blob, { contentType: mime });
      const url = await getDownloadURL(r);
      setAvatar(url);
    } catch (e) {
      setErr(e.message);
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    if (!user) return;
    setErr("");
    setSaving(true);
    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, "users", user.uid);
        const snap = await tx.get(userRef);
        const prev = snap.exists() ? snap.data() : {};

        const prevUsername = (prev.username || "").trim().toLowerCase();
        const nextUsername = (username || "").trim().toLowerCase();
        if (nextUsername && nextUsername !== prevUsername) {
          const nextRef = doc(db, "usernames", nextUsername);
          const nextSnap = await tx.get(nextRef);
          if (nextSnap.exists()) throw new Error("Ese @usuario ya está en uso");
          if (prevUsername) tx.delete(doc(db, "usernames", prevUsername));
          tx.set(nextRef, { uid: user.uid });
        }

        tx.set(userRef, {
          ...prev,
          displayName: displayName || "",
          username: nextUsername || "",
          avatar: avatar || "",
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });
      Alert.alert("Listo", "Perfil actualizado");
      navigation.goBack();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Editar perfil</Text>
      <View style={{ alignItems: "center", marginBottom: 14 }}>
        <Image source={{ uri: avatar || `https://i.pravatar.cc/200?u=${user?.uid}` }} style={styles.avatar} />
        <TouchableOpacity onPress={pickAndUpload} style={styles.uploadBtn} disabled={uploading}>
          {uploading ? <ActivityIndicator /> : <Text style={styles.uploadTxt}>Cambiar avatar</Text>}
        </TouchableOpacity>
      </View>
      <TextInput style={styles.input} placeholder="Nombre para mostrar" value={displayName} onChangeText={setDisplayName} />
      <TextInput style={styles.input} placeholder="Usuario (sin @)" autoCapitalize="none" value={username} onChangeText={setUsername} />
      {err ? <Text style={styles.error}>{err}</Text> : null}
      <TouchableOpacity style={styles.btn} onPress={onSave} disabled={saving}>
        {saving ? <ActivityIndicator /> : <Text style={styles.btnTxt}>Guardar</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 10, padding: 12, marginBottom: 12 },
  btn: { backgroundColor: "#8e44ad", padding: 14, borderRadius: 10, alignItems: "center" },
  btnTxt: { color: "#fff", fontWeight: "bold" },
  error: { color: "crimson", marginBottom: 8 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#eee" },
  uploadBtn: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#f0f0f0", borderRadius: 8 },
  uploadTxt: { fontWeight: "600" },
});
