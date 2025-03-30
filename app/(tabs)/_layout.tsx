// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false, // Hide the header in all screens
        contentStyle: { backgroundColor: '#f5f5f5' },
        tabBarStyle: {
          backgroundColor: 'rgba(30, 7, 55, 0.95)',
          borderTopColor: '#00DDEB',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#00DDEB',
        tabBarInactiveTintColor: '#B39DDB',
        tabBarLabelStyle: {
          fontFamily: 'monospace',
          fontSize: 12,
        },
        tabBarBackground: () => (
          <LinearGradient
            colors={['rgba(45, 13, 83, 0.9)', 'rgba(30, 7, 55, 0.95)']}
            style={StyleSheet.absoluteFill}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <View style={styles.iconContainer}>
              <FontAwesome name="home" size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color }) => (
            <View style={styles.iconContainer}>
              <FontAwesome name="users" size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="setting"
        options={{
          title: 'Setting',
          tabBarIcon: ({ color }) => (
            <View style={styles.iconContainer}>
              <FontAwesome name="user" size={24} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  }
});