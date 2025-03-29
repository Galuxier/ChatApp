import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { useAuth } from '../../context/auth';
import { router, useFocusEffect } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';

interface Chat {
  id: string;
  userId: string;
  displayName: string;
  profileImage: string | null;
  lastMessage: string;
  timestamp: any;
  unreadCount: number;
}

export default function ChatsScreen() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { user } = useAuth();

  // React hook to refetch data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchChats();
      return () => {}; // cleanup function (optional)
    }, [user])
  );

  const fetchChats = async () => {
    if (!user) {
      return;
    }

    try {
      // Get all chat IDs where the current user is participating
      const chatIdsQuery = query(
        collection(db, 'userChats'),
        where('userId', '==', user.uid)
      );

      const unsubscribe = onSnapshot(chatIdsQuery, async (chatIdsSnapshot) => {
        if (chatIdsSnapshot.empty) {
          setChats([]);
          setLoading(false);
          return;
        }

        const chatPromises = chatIdsSnapshot.docs.map(async (docSnapshot) => {
          const chatData = docSnapshot.data();
          const chatId = chatData.chatId;
          const friendId = chatData.friendId;
          
          // Get user info for this chat
          const userDoc = await getDoc(doc(db, 'users', friendId));
          const userData = userDoc.exists() ? userDoc.data() : null;
          
          // Get chat info
          const chatDoc = await getDoc(doc(db, 'chats', chatId));
          const chatInfo = chatDoc.exists() ? chatDoc.data() : null;
          
          // Get last message
          const messagesQuery = query(
            collection(db, 'chats', chatId, 'messages'),
            orderBy('timestamp', 'desc'),
            limit(1)
          );
          
          const messagesSnapshot = await getDocs(messagesQuery);
          let lastMessage = 'No messages yet';
          let timestamp = new Date();
          
          if (!messagesSnapshot.empty) {
            const lastMessageData = messagesSnapshot.docs[0].data();
            lastMessage = lastMessageData.text || 'No messages yet';
            timestamp = lastMessageData.timestamp?.toDate() || new Date();
          } else if (chatInfo?.lastMessageTime) {
            // Fallback to chat document if available
            lastMessage = chatInfo.lastMessage || 'No messages yet';
            timestamp = chatInfo.lastMessageTime.toDate() || new Date();
          }
          
          return {
            id: chatId,
            userId: friendId,
            displayName: userData?.displayName || 'Unknown User',
            profileImage: userData?.profileImage || null,
            lastMessage,
            timestamp,
            unreadCount: 0, // This would need to be implemented with a proper read/unread system
          };
        });
        
        const resolvedChats = await Promise.all(chatPromises);
        setChats(resolvedChats);
        setLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error fetching chats:', error);
      setLoading(false);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Today, show time
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    }
    
    // Within a week, show day
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    
    // Older, show date
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => router.push('/add-friend')}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {chats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Image 
            source={{ uri: 'https://via.placeholder.com/150' }} 
            style={styles.emptyImage} 
          />
          <Text style={styles.emptyTitle}>No chats yet</Text>
          <Text style={styles.emptyText}>Add friends using their Ping ID to start chatting</Text>
          <TouchableOpacity 
            style={styles.emptyButton}
            onPress={() => router.push('/add-friend')}
          >
            <Text style={styles.emptyButtonText}>Add Friend</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.chatItem}
              onPress={() => router.push(`/chat/${item.userId}`)}
            >
              {item.profileImage ? (
                <Image source={{ uri: item.profileImage }} style={styles.avatar} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.chatInfo}>
                <View style={styles.chatHeader}>
                  <Text style={styles.chatName}>{item.displayName}</Text>
                  <Text style={styles.chatTime}>{formatTime(item.timestamp)}</Text>
                </View>
                <View style={styles.chatFooter}>
                  <Text 
                    style={styles.chatMessage}
                    numberOfLines={1}
                  >
                    {item.lastMessage}
                  </Text>
                  {item.unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{item.unreadCount}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
    marginTop: -2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyImage: {
    width: 150,
    height: 150,
    marginBottom: 20,
    opacity: 0.7,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2c3e50',
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 30,
  },
  emptyButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 5,
  },
  emptyButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  chatItem: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  chatTime: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  chatFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatMessage: {
    fontSize: 14,
    color: '#7f8c8d',
    flex: 1,
    marginRight: 10,
  },
  unreadBadge: {
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});