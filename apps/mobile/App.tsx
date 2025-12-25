import "./global.css";
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';

export default function App() {
  return (
    <View className="flex-1 bg-white items-center justify-content-center">
      <Text className="text-red-500">Open up App.tsx to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
  );
}
