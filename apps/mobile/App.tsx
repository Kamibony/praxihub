import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

// --- CONFIGURATION ---
// Vaša konfigurácia z Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyDyTuAJwecFtMovWS-452rsgvC5IdweWGk",
  authDomain: "praxihub-app.firebaseapp.com",
  projectId: "praxihub-app",
  storageBucket: "praxihub-app.firebasestorage.app",
  messagingSenderId: "365164154200",
  appId: "1:365164154200:web:943c3cdaa99ba8002b692d",
  measurementId: "G-H3MKYYH1ZH"
};

// Initialize Firebase (Singleton pattern to avoid re-initialization warnings)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app);

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [uploading, setUploading] = useState(false);

  // Sledovanie stavu prihlásenia
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  // Funkcia na prihlásenie
  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      Alert.alert("Chyba prihlásenia", e.message);
    }
  };

  // Funkcia na výber/fotenie obrázka
  const pickImage = async () => {
    // 1. Žiadosť o povolenie k fotoaparátu
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Chyba', 'Potrebujeme prístup k fotoaparátu na odfotenie zmluvy!');
      return;
    }

    // 2. Spustenie fotoaparátu
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7, // Kompresia, aby sa to rýchlejšie nahrávalo
    });

    if (!result.canceled) {
      uploadImage(result.assets[0].uri);
    }
  };

  // Funkcia na upload do Firebase
  const uploadImage = async (uri: string) => {
    if (!user) return;
    setUploading(true);
    try {
      // 1. Konverzia URI na Blob (binárne dáta)
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `mobile_upload_${Date.now()}.jpg`;

      // 2. Upload do Storage
      const storageRef = ref(storage, `contracts/${user.uid}/${filename}`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      // 3. Vytvorenie dokumentu vo Firestore (spustí AI analýzu na backende)
      await addDoc(collection(db, "internships"), {
        studentId: user.uid,
        studentEmail: user.email,
        contract_url: downloadURL,
        status: "ANALYZING", // Toto spustí Cloud Function
        createdAt: new Date().toISOString(),
        fileName: filename,
        source: "mobile_app"
      });

      Alert.alert("Úspech", "Zmluva bola nahraná a odoslaná na AI analýzu!");
    } catch (e: any) {
      console.error(e);
      Alert.alert("Chyba nahrávania", e.message);
    } finally {
      setUploading(false);
    }
  };

  // --- UI: Prihlasovacia obrazovka ---
  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>PraxiHub Mobile</Text>
        <TextInput 
          style={styles.input} 
          placeholder="Email" 
          value={email} 
          onChangeText={setEmail} 
          autoCapitalize='none' 
          keyboardType='email-address'
        />
        <TextInput 
          style={styles.input} 
          placeholder="Heslo" 
          value={password} 
          onChangeText={setPassword} 
          secureTextEntry 
        />
        <Button title="Prihlásiť sa" onPress={handleLogin} />
        <StatusBar style="auto" />
      </View>
    );
  }

  // --- UI: Hlavná obrazovka (po prihlásení) ---
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vitaj, {user.email}</Text>
      
      <View style={styles.card}>
        <Text style={styles.subtitle}>Nahrát novou smlouvu</Text>
        <Text style={styles.infoText}>Odfotťe zmluvu a my automaticky vyplníme údaje pomocou AI.</Text>
        
        <View style={styles.spacer} />
        
        <Button title="Vyfotiť zmluvu" onPress={pickImage} disabled={uploading} />
        
        {uploading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text>Nahrávam...</Text>
          </View>
        )}
      </View>

      <View style={{marginTop: 50}}>
        <Button title="Odhlásiť sa" color="red" onPress={() => signOut(auth)} />
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  infoText: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd'
  },
  card: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 20,
    width: '100%',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  spacer: {
    height: 10,
  },
  loadingContainer: {
    marginTop: 20,
    alignItems: 'center',
  }
});
