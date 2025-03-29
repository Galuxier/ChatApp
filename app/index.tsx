// app/index.tsx
import { Redirect } from 'expo-router';
import { useAuth } from '../context/auth';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }
  
  return user ? <Redirect href="/(tabs)/chats" /> : <Redirect href="/login" />;
}