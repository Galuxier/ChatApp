import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

// Import screens
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ChatScreen from './screens/ChatScreen';
import ChatListScreen from './screens/ChatListScreen';
import ProfileScreen from './screens/ProfileScreen';
import AddFriendScreen from './screens/AddFriendScreen';

// Define stack param list types
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ChatList: undefined;
  Chat: { userId: string };
  Profile: undefined;
  AddFriend: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type AppStackParamList = {
  ChatList: undefined;
  Chat: { userId: string };
  Profile: undefined;
  AddFriend: undefined;
};

// Create stacks
const Stack = createStackNavigator<RootStackParamList>();
const AuthStack = createStackNavigator<AuthStackParamList>();
const AppStack = createStackNavigator<AppStackParamList>();

// Auth stack - screens for unauthenticated users
const AuthNavigator = () => {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
};

// App stack - screens for authenticated users
const AppNavigator = () => {
  return (
    <AppStack.Navigator>
      <AppStack.Screen 
        name="ChatList" 
        component={ChatListScreen} 
        options={{ headerShown: false }}
      />
      <AppStack.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={({ route }) => ({ title: 'Chat' })}
      />
      <AppStack.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ title: 'My Profile' }}
      />
      <AppStack.Screen 
        name="AddFriend" 
        component={AddFriendScreen} 
        options={{ title: 'Add Friend' }}
      />
    </AppStack.Navigator>
  );
};

// Main component to handle auth state
const AuthHandler = () => {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (initializing) setInitializing(false);
    });

    // Clean up subscription
    return unsubscribe;
  }, [initializing]);

  // Show loading indicator while checking auth state
  if (initializing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});

export default AuthHandler;