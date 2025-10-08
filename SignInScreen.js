// SignInScreen.js
import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { auth } from "./firebase";

export default function SignInScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async () => {
    setErr("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Iniciar sesión</Text>
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Contraseña" secureTextEntry value={password} onChangeText={setPassword} />
      {err ? <Text style={styles.error}>{err}</Text> : null}
      <TouchableOpacity style={styles.btn} onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator /> : <Text style={styles.btnTxt}>Entrar</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
        <Text style={{ marginTop: 16 }}>¿No tienes cuenta? <Text style={{ fontWeight: "bold" }}>Regístrate</Text></Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "bold", marginBottom: 16, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 10, padding: 12, marginBottom: 12 },
  btn: { backgroundColor: "#3498db", padding: 14, borderRadius: 10, alignItems: "center" },
  btnTxt: { color: "#fff", fontWeight: "bold" },
  error: { color: "crimson", marginBottom: 8 },
});
