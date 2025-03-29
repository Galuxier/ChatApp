// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color }) => <FontAwesome name="comments" size={24} color={color} />,
          headerTitle: 'Chats',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <FontAwesome name="user" size={24} color={color} />,
          headerTitle: 'My Profile',
        }}
      />
    </Tabs>
  );
}