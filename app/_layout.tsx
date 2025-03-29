// app/_layout.tsx
import { Stack } from 'expo-router';
import { AuthProvider } from '../context/auth';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
        <Stack.Screen name="add-friend" options={{ title: 'Add Friend' }} />
      </Stack>
    </AuthProvider>
  );
}