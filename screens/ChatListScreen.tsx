import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';

type ChatListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ChatList'>;

interface Props {
  navigation: ChatListScreenNavigationProp;
}

interface Chat {
  id: string;
  userId: string;
  displayName: string;
  lastMessage: string;
  timestamp: any;
  unreadCount: number;
}

export default function ChatListScreen({ navigation }: Props) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!auth.currentUser) {
      navigation.navigate('Login');
      return;
    }

    const fetchChats = async () => {
      try {
        // Get all chat IDs where the current user is participating
        const chatIdsQuery = query(
          collection(db, 'userChats'),
          where('userId', '==', auth.currentUser!.uid)
        );

        onSnapshot(chatIdsQuery, async (chatIdsSnapshot) => {
          const chatPromises = chatIdsSnapshot.docs.map(async (doc) => {
            const chatId = doc.data().chatId;
            const otherUserId = chatId.replace(auth.currentUser!.uid, '').replace('_', '');
            
            // Get user info for this chat
            const userDoc = await getDoc(doc(db, 'users', otherUserId));
            const userData = userDoc.data();
            
            // Get last message
            const messagesQuery = query(
              collection(db, 'chats', chatId, 'messages'),
              // orderBy('timestamp', 'desc'),
              // limit(1)
            );
            
            const messagesSnapshot = await getDocs(messagesQuery);
            let lastMessage = 'No messages yet';
            let timestamp = new Date();
            
            if (!messagesSnapshot.empty) {
              const lastMessageDoc = messagesSnapshot.docs[0];
              lastMessage = lastMessageDoc.data().text;
              timestamp = lastMessageDoc.data().timestamp;
            }
            
            return {
              id: chatId,
              userId: otherUserId,
              displayName: userData?.displayName || 'Unknown User',
              lastMessage,
              timestamp,
              unreadCount: 0, // This would need to be implemented with a proper read/unread system
            };
          });
          
          const resolvedChats = await Promise.all(chatPromises);
          setChats(resolvedChats);
          setLoading(false);
        });
      } catch (error) {
        console.error('Error fetching chats:', error);
        setLoading(false);
      }
    };

    fetchChats();
  }, [navigation]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => navigation.navigate('AddFriend')}
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
            onPress={() => navigation.navigate('AddFriend')}
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
              onPress={() => navigation.navigate('Chat', { userId: item.userId })}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
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
      
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem}>
          <Text style={[styles.tabText, styles.activeTab]}>Chats</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.tabItem}
          onPress={() => navigation.navigate('Profile')}
        >
          <Text style={styles.tabText}>Profile</Text>
        </TouchableOpacity>
      </View>
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
    tabBar: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: '#e0e0e0',
      backgroundColor: 'white',
      height: 60,
    },
    tabItem: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tabText: {
      fontSize: 16,
      color: '#7f8c8d',
    },
    activeTab: {
      color: '#3498db',
      fontWeight: 'bold',
    },
  });