import React, { useEffect, useState } from 'react';
import { 
  View, 
  FlatList, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Image, 
  ActivityIndicator, 
  TextInput,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
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

export default function FriendsScreen() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { user } = useAuth();

  useEffect(() => {
    let chatListenerUnsubscribe: (() => void) | null = null;
    let messageListenersUnsubscribe: (() => void)[] = [];
    
    const fetchChats = async () => {
      if (!user) {
        setChats([]);
        setFilteredChats([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const chatIdsQuery = query(
          collection(db, 'userChats'),
          where('userId', '==', user.uid)
        );

        chatListenerUnsubscribe = onSnapshot(chatIdsQuery, async (chatIdsSnapshot) => {
          if (chatIdsSnapshot.empty) {
            setChats([]);
            setFilteredChats([]);
            setLoading(false);
            return;
          }

          try {
            messageListenersUnsubscribe.forEach(unsub => unsub());
            messageListenersUnsubscribe = [];
            
            const chatPromises = chatIdsSnapshot.docs.map(async (docSnapshot) => {
              const chatData = docSnapshot.data();
              const chatId = chatData.chatId;
              const friendId = chatData.friendId;
              
              const userDoc = await getDoc(doc(db, 'users', friendId));
              const userData = userDoc.exists() ? userDoc.data() : null;
              
              const chatDoc = await getDoc(doc(db, 'chats', chatId));
              const chatInfo = chatDoc.exists() ? chatDoc.data() : null;
              
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
                lastMessage = chatInfo.lastMessage || 'No messages yet';
                timestamp = chatInfo.lastMessageTime.toDate() || new Date();
              }
              
              const unreadQuery = query(
                collection(db, 'chats', chatId, 'messages'),
                where('senderId', '!=', user.uid)
              );

              const unreadSnapshot = await getDocs(unreadQuery);
              const unreadCount = unreadSnapshot.docs.filter(doc => 
                doc.data().status !== 'read'
              ).length;
              
              return {
                id: chatId,
                userId: friendId,
                displayName: userData?.displayName || 'Unknown User',
                profileImage: userData?.profileImage || null,
                lastMessage,
                timestamp,
                unreadCount,
              };
            });
            
            const resolvedChats = await Promise.all(chatPromises);
            const sortedChats = resolvedChats.sort((a, b) => b.timestamp - a.timestamp);
            setChats(sortedChats);
            setFilteredChats(sortedChats);
            
            sortedChats.forEach(chat => {
              const messagesListener = onSnapshot(
                query(
                  collection(db, 'chats', chat.id, 'messages'),
                  orderBy('timestamp', 'desc')
                ),
                async (messagesSnapshot) => {
                  if (messagesSnapshot.empty) return;
                  
                  const lastMessageDoc = messagesSnapshot.docs[0];
                  const lastMessageData = lastMessageDoc.data();
                  const unreadCount = messagesSnapshot.docs.filter(doc => {
                    const data = doc.data();
                    return data.senderId !== user.uid && data.status !== 'read';
                  }).length;
                  
                  setChats(prevChats => {
                    const updatedChats = [...prevChats.map(prevChat => 
                      prevChat.id === chat.id 
                        ? {
                            ...prevChat,
                            lastMessage: lastMessageData.text || 'No message',
                            timestamp: lastMessageData.timestamp?.toDate() || new Date(),
                            unreadCount
                          } 
                        : prevChat
                    ).sort((a, b) => b.timestamp - a.timestamp)];
                    
                    // Also update filtered chats with search query
                    setFilteredChats(filterChatsByName(updatedChats, searchQuery));
                    
                    return updatedChats;
                  });
                },
                error => {
                  console.error(`Error in messages listener for chat ${chat.id}:`, error);
                }
              );
              messageListenersUnsubscribe.push(messagesListener);
            });
          } catch (err) {
            console.error("Error processing chat data:", err);
          } finally {
            setLoading(false);
          }
        }, (error) => {
          console.error('Error in chat snapshot listener:', error);
          setLoading(false);
        });
      } catch (error) {
        console.error('Error setting up chat listener:', error);
        setLoading(false);
      }
    };

    fetchChats();

    return () => {
      if (chatListenerUnsubscribe) chatListenerUnsubscribe();
      messageListenersUnsubscribe.forEach(unsub => unsub());
    };
  }, [user]);
  
  // Handle search input changes
  useEffect(() => {
    setFilteredChats(filterChatsByName(chats, searchQuery));
  }, [searchQuery]);
  
  // Function to filter chats by display name
  const filterChatsByName = (chatsList: Chat[], query: string) => {
    if (!query.trim()) return chatsList;
    
    return chatsList.filter(chat => 
      chat.displayName.toLowerCase().includes(query.toLowerCase())
    );
  };

  useFocusEffect(
    React.useCallback(() => {
      return () => {};
    }, [user, chats])
  );

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  // Function to get initials from name for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => router.push('/add-friend')}
        >
          <FontAwesome name="user-plus" size={18} color="white" />
        </TouchableOpacity>
      </View>
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <FontAwesome name="search" size={16} color="#95a5a6" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations"
            placeholderTextColor="#95a5a6"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <FontAwesome name="times-circle" size={16} color="#95a5a6" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {filteredChats.length === 0 ? (
        <View style={styles.emptyContainer}>
          {searchQuery ? (
            <>
              <FontAwesome name="search" size={50} color="#bdc3c7" style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>No matches found</Text>
              <Text style={styles.emptyText}>No friends match "{searchQuery}"</Text>
              <TouchableOpacity 
                style={styles.clearSearchButton}
                onPress={clearSearch}
              >
                <Text style={styles.clearSearchButtonText}>Clear Search</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <FontAwesome name="users" size={60} color="#bdc3c7" style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyText}>Add friends to start chatting</Text>
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={() => router.push('/add-friend')}
              >
                <FontAwesome name="user-plus" size={16} color="white" style={styles.buttonIcon} />
                <Text style={styles.emptyButtonText}>Add New Friend</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.chatItem}
              onPress={() => router.push(`/chat/${item.userId}`)}
            >
              <View style={[styles.avatarContainer, item.unreadCount > 0 && styles.activeAvatarContainer]}>
                {item.profileImage ? (
                  <Image source={{ uri: item.profileImage }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarFallback, { backgroundColor: getColorFromName(item.displayName) }]}>
                    <Text style={styles.avatarText}>
                      {getInitials(item.displayName)}
                    </Text>
                  </View>
                )}
                {item.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>
                      {item.unreadCount > 99 ? '99+' : item.unreadCount}
                    </Text>
                  </View>
                )}
              </View>
              
              <View style={styles.chatInfo}>
                <View style={styles.chatHeader}>
                  <Text 
                    style={[styles.chatName, item.unreadCount > 0 && styles.unreadChatName]}
                    numberOfLines={1}
                  >
                    {item.displayName}
                  </Text>
                  <Text style={[styles.chatTime, item.unreadCount > 0 && styles.unreadChatTime]}>
                    {formatTime(item.timestamp)}
                  </Text>
                </View>
                <Text 
                  style={[styles.chatMessage, item.unreadCount > 0 && styles.unreadChatMessage]}
                  numberOfLines={1}
                >
                  {item.lastMessage}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

// Function to generate consistent color based on name
const getColorFromName = (name: string) => {
  // List of pleasant colors for avatars
  const colors = [
    '#3498db', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c',
    '#f1c40f', '#e74c3c', '#34495e', '#16a085', '#27ae60',
    '#8e44ad', '#d35400', '#2980b9', '#c0392b'
  ];
  
  // Simple hash function for name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Select color based on hash
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2c3e50',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6f8fa',
    borderRadius: 10,
    paddingHorizontal: 15,
    height: 45,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#34495e',
  },
  clearButton: {
    padding: 5,
  },
  listContainer: {
    paddingTop: 5,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    marginHorizontal: 10,
    marginVertical: 5,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 15,
  },
  activeAvatarContainer: {
    transform: [{ scale: 1.05 }],
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e0e0e0',
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  unreadBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#e74c3c',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  unreadText: {
    color: 'white',
    fontSize: 11,
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
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    maxWidth: '80%',
  },
  unreadChatName: {
    fontWeight: '800',
    color: '#000',
  },
  chatTime: {
    fontSize: 12,
    color: '#95a5a6',
  },
  unreadChatTime: {
    color: '#3498db',
  },
  chatMessage: {
    fontSize: 14,
    color: '#7f8c8d',
    marginRight: 20,
  },
  unreadChatMessage: {
    color: '#34495e',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
    color: '#2c3e50',
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 30,
    maxWidth: '80%',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  buttonIcon: {
    marginRight: 8,
  },
  emptyButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  clearSearchButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3498db',
  },
  clearSearchButtonText: {
    color: '#3498db',
    fontWeight: '600',
    fontSize: 16,
  }
});