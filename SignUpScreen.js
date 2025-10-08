import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "./firebase";

export default function SignUpScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async () => {
    setErr("");

    const uname = username.trim().toLowerCase();
    if (!uname) {
      setErr("Debes elegir un nombre de usuario");
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(uname)) {
      setErr(
        "El usuario debe tener entre 3 y 20 caracteres, solo letras, números o guiones bajos."
      );
      return;
    }

    setLoading(true);
    try {
      // 1️⃣ Crear usuario en Auth
      const { user } = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      await updateProfile(user, { displayName });

      // 2️⃣ Verificar si el username ya está en uso
      const unameRef = doc(db, "usernames", uname);
      const exists = await getDoc(unameRef);
      if (exists.exists()) throw new Error("Ese @usuario ya está en uso");

      // 3️⃣ Reservar username en colección `usernames`
      await setDoc(unameRef, { uid: user.uid });

      // 4️⃣ Crear documento en `users/{uid}`
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: displayName || "",
        username: uname, // 👈 Aquí se guarda el username escrito
        avatar: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 5️⃣ Navegar o mostrar confirmación
      navigation.navigate("HomeTab"); // o la pantalla que uses tras registrarte
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crear cuenta</Text>

      <TextInput
        style={styles.input}
        placeholder="Nombre para mostrar"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        style={styles.input}
        placeholder="Usuario (sin @)"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {err ? <Text style={styles.error}>{err}</Text> : null}

      <TouchableOpacity
        style={styles.btn}
        onPress={onSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.btnTxt}>Registrarme</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={{ marginTop: 16 }}>
          ¿Ya tienes cuenta?{" "}
          <Text style={{ fontWeight: "bold" }}>Inicia sesión</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: "#27ae60",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnTxt: { color: "#fff", fontWeight: "bold" },
  error: { color: "crimson", marginBottom: 8 },
});
