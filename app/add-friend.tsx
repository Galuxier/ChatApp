import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Keyboard,
  SafeAreaView
} from 'react-native';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { router } from 'expo-router';
import { useAuth } from '../context/auth';
import { FontAwesome } from '@expo/vector-icons';

export default function AddFriendScreen() {
  const { user } = useAuth();
  const [pingId, setPingId] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isAdding, setIsAdding] = useState<boolean>(false);

  const searchUser = async () => {
    if (pingId.trim() === '') {
      Alert.alert('Error', 'Please enter a Ping ID');
      return;
    }

    setIsSearching(true);
    setSearchResult(null);
    Keyboard.dismiss();

    try {
      // Query Firestore to find user with this pingId
      const q = query(
        collection(db, 'users'),
        where('pingId', '==', pingId.trim())
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setSearchResult({ found: false });
      } else {
        // User found
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        
        // Don't allow adding yourself
        if (userDoc.id === user?.uid) {
          Alert.alert('Error', 'You cannot add yourself as a friend');
          setIsSearching(false);
          return;
        }
        
        setSearchResult({
          found: true,
          userId: userDoc.id,
          displayName: userData.displayName,
          pingId: userData.pingId
        });
      }
    } catch (error) {
      console.error('Error searching for user:', error);
      Alert.alert('Error', 'Failed to search for user. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const addFriend = async () => {
    if (!searchResult || !searchResult.found || !user) return;
    
    setIsAdding(true);
    
    try {
      const currentUserId = user.uid;
      const friendId = searchResult.userId;
      
      // Create or get the chat document between these users
      const chatId = [currentUserId, friendId].sort().join('_');
      
      await Promise.all([
        // Create userChat for current user
        setDoc(doc(db, 'userChats', `${currentUserId}_${chatId}`), {
          userId: currentUserId,
          chatId: chatId,
          friendId: friendId,
          createdAt: new Date()
        }),
        
        // Create userChat for the friend
        setDoc(doc(db, 'userChats', `${friendId}_${chatId}`), {
          userId: friendId,
          chatId: chatId,
          friendId: currentUserId,
          createdAt: new Date()
        }),
        
        // Create chat document
        setDoc(doc(db, 'chats', chatId), {
          participants: [currentUserId, friendId],
          createdAt: new Date(),
          updatedAt: new Date()
        })
      ]);

      Alert.alert(
        'Success', 
        `${searchResult.displayName} added successfully!`,
        [
          { 
            text: 'Start Chat', 
            onPress: () => router.push(`/chat/${friendId}`)
          },
          {
            text: 'Back to Chats',
            onPress: () => router.push('/(tabs)/chats')
          }
        ]
      );
    } catch (error) {
      console.error('Error adding friend:', error);
      Alert.alert('Error', 'Failed to add friend. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <FontAwesome name="arrow-left" size={20} color="#3498db" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Friend</Text>
        <View style={styles.headerRight} />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.subtitle}>Enter your friend's Ping ID to connect</Text>
        
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter Ping ID"
            value={pingId}
            onChangeText={setPingId}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity 
            style={styles.searchButton} 
            onPress={searchUser}
            disabled={isSearching}
          >
            {isSearching ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>
        
        {searchResult && (
          <View style={styles.resultContainer}>
            {searchResult.found ? (
              <>
                <View style={styles.userFound}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {searchResult.displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.displayName}>{searchResult.displayName}</Text>
                    <Text style={styles.pingIdText}>Ping ID: {searchResult.pingId}</Text>
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={styles.addButton}
                  onPress={addFriend}
                  disabled={isAdding}
                >
                  {isAdding ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.addButtonText}>Add Friend</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.notFound}>
                <Text style={styles.notFoundText}>No user found with this Ping ID</Text>
                <Text style={styles.notFoundSubtext}>Check the ID and try again</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    color: '#7f8c8d',
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  input: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 5,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 10,
  },
  searchButton: {
    backgroundColor: '#3498db',
    borderRadius: 5,
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  searchButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  resultContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  userFound: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  pingIdText: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  addButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  notFound: {
    alignItems: 'center',
    padding: 20,
  },
  notFoundText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 10,
  },
  notFoundSubtext: {
    fontSize: 14,
    color: '#7f8c8d',
  },
});