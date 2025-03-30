// app/(tabs)/home/_layout.tsx
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

export default function HomeLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackground: () => (
          <LinearGradient
            colors={['rgba(30, 7, 55, 0.9)', 'rgba(45, 13, 83, 0.8)']}
            style={StyleSheet.absoluteFill}
          />
        ),
        headerTitleStyle: {
          color: '#D1C4E9',
          fontFamily: 'monospace',
          fontSize: 18,
          fontWeight: 'bold',
        },
        headerTintColor: '#00DDEB',
        headerStyle: {
          height: 100,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(179, 157, 219, 0.3)',
        },
        headerBackTitleVisible: false,
        headerBackImage: () => (
          <View style={{ marginLeft: 10 }}>
            <FontAwesome name="arrow-left" size={20} color="#00DDEB" />
          </View>
        ),
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen 
        name="profile" 
        options={{ 
          title: 'Profile',
          headerLeft: () => (
            <View style={styles.headerLeft}>
              <FontAwesome name="user" size={16} color="#00DDEB" style={styles.headerIcon} />
            </View>
          ),
        }} 
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  headerLeft: {
    marginLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 8,
  },
});