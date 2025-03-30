import { Stack } from 'expo-router';
import { AuthProvider } from '../context/auth';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerShown: false, 
          contentStyle: { backgroundColor: '#f5f5f5' }
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="add-friend" />
      </Stack>
    </AuthProvider>
  );
}