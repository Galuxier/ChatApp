import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, TouchableOpacity, ActivityIndicator, Button } from 'react-native';
import { collection, onSnapshot, DocumentData } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';

type UserListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'UserList'>;

interface Props {
  navigation: UserListScreenNavigationProp;
}

interface User {
  id: string;
  displayName: string;
  email?: string;
}

export default function UserListScreen({ navigation }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!auth.currentUser) {
      navigation.navigate('Login'); // ถ้ายังไม่ล็อกอิน ให้กลับไปหน้า Login
      return;
    }

    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const userList = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as DocumentData) } as User));
      const filteredUsers = userList.filter(user => user.id !== auth.currentUser?.uid);
      setUsers(filteredUsers);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigation]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View>
      {users.length === 0 ? (
        <Text>No other users found</Text>
      ) : (
        <FlatList
          data={users}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => navigation.navigate('Chat', { userId: item.id })}>
              <Text>{item.displayName}</Text>
            </TouchableOpacity>
          )}
          keyExtractor={item => item.id}
        />
      )}
      <Button title="Profile" onPress={() => navigation.navigate('Profile')} />
    </View>
  );
}