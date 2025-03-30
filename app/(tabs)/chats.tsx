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
  StatusBar,
  ImageBackground,
  Animated,
  Dimensions,
} from 'react-native';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/auth';
import { router, useFocusEffect } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

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

  // Animation for stars
  const stars = [...Array(20)].map(() => ({
    top: Math.random() * height,
    left: Math.random() * width,
    size: Math.random() * 3 + 1,
    opacity: new Animated.Value(Math.random() * 0.5 + 0.1),
    duration: Math.random() * 2000 + 1000,
  }));

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
              let lastMessage = 'No transmissions yet';
              let timestamp = new Date();
              
              if (!messagesSnapshot.empty) {
                const lastMessageData = messagesSnapshot.docs[0].data();
                lastMessage = lastMessageData.text || 'No transmissions yet';
                timestamp = lastMessageData.timestamp?.toDate() || new Date();
              } else if (chatInfo?.lastMessageTime) {
                lastMessage = chatInfo.lastMessage || 'No transmissions yet';
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
                displayName: userData?.displayName || 'Unknown Contact',
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
                            lastMessage: lastMessageData.text || 'No transmission',
                            timestamp: lastMessageData.timestamp?.toDate() || new Date(),
                            unreadCount
                          } 
                        : prevChat
                    ).sort((a, b) => b.timestamp - a.timestamp)];
                    
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

    // Animate stars twinkling
    stars.forEach(star => {
      const twinkle = () => {
        Animated.sequence([
          Animated.timing(star.opacity, {
            toValue: Math.random() * 0.7 + 0.3,
            duration: star.duration,
            useNativeDriver: true,
          }),
          Animated.timing(star.opacity, {
            toValue: Math.random() * 0.5 + 0.1,
            duration: star.duration,
            useNativeDriver: true,
          }),
        ]).start(twinkle);
      };
      twinkle();
    });

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
      <ImageBackground 
        source={{ uri: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=1000' }} 
        style={styles.backgroundImage}
      >
        <LinearGradient
          colors={['rgba(45, 13, 83, 0.7)', 'rgba(76, 41, 122, 0.85)', 'rgba(30, 7, 55, 0.95)']}
          style={styles.gradient}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#B39DDB" />
            <Text style={styles.loadingText}>Scanning for Contacts...</Text>
          </View>
        </LinearGradient>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground 
      source={{ uri: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=1000' }} 
      style={styles.backgroundImage}
    >
      <LinearGradient
        colors={['rgba(45, 13, 83, 0.7)', 'rgba(76, 41, 122, 0.85)', 'rgba(30, 7, 55, 0.95)']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" />
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Contacts</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => router.push('/add-friend')}
            >
              <LinearGradient
                colors={['#9C27B0', '#673AB7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientButton}
              >
                <FontAwesome name="user-plus" size={18} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
          
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <FontAwesome name="search" size={16} color="#B39DDB" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search contacts"
                placeholderTextColor="#B39DDB"
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                  <FontAwesome name="times-circle" size={16} color="#B39DDB" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {filteredChats.length === 0 ? (
            <View style={styles.emptyContainer}>
              {searchQuery ? (
                <>
                  <FontAwesome name="search" size={50} color="#B39DDB" style={styles.emptyIcon} />
                  <Text style={styles.emptyTitle}>No signals detected</Text>
                  <Text style={styles.emptyText}>No contacts match "{searchQuery}"</Text>
                  <TouchableOpacity 
                    style={styles.clearSearchButton}
                    onPress={clearSearch}
                  >
                    <Text style={styles.clearSearchButtonText}>Clear Search</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <FontAwesome name="users" size={60} color="#B39DDB" style={styles.emptyIcon} />
                  <Text style={styles.emptyTitle}>No contacts yet</Text>
                  <Text style={styles.emptyText}>Add contacts to begin transmission</Text>
                  <TouchableOpacity 
                    style={styles.emptyButton}
                    onPress={() => router.push('/add-friend')}
                  >
                    <LinearGradient
                      colors={['#9C27B0', '#673AB7']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.gradientButton}
                    >
                      <FontAwesome name="user-plus" size={16} color="white" style={styles.buttonIcon} />
                      <Text style={styles.emptyButtonText}>Add New Contact</Text>
                    </LinearGradient>
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
                      <LinearGradient
                        colors={['#9C27B0', '#673AB7']}
                        style={styles.avatarFallback}
                      >
                        <Text style={styles.avatarText}>
                          {getInitials(item.displayName)}
                        </Text>
                      </LinearGradient>
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

          {/* Animated stars */}
          <View style={styles.starsContainer}>
            {stars.map((star, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.star,
                  {
                    top: star.top,
                    left: star.left,
                    width: star.size,
                    height: star.size,
                    opacity: star.opacity,
                  },
                ]}
              />
            ))}
          </View>
        </SafeAreaView>
      </LinearGradient>
    </ImageBackground>
  );
}

// Function to generate consistent color based on name
const getColorFromName = (name: string) => {
  const colors = [
    '#9C27B0', '#673AB7', '#3F51B5', '#00DDEB', '#1E90FF',
    '#FF4081', '#FF5722', '#4CAF50', '#E91E63', '#2196F3',
    '#8BC34A', '#F44336', '#03A9F4', '#CDDC39'
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#D1C4E9',
    fontSize: 16,
    marginTop: 10,
    fontFamily: 'monospace',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(179, 157, 219, 0.3)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#D1C4E9',
    fontFamily: 'monospace',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  gradientButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(179, 157, 219, 0.3)',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 15,
    height: 45,
    borderWidth: 1,
    borderColor: 'rgba(179, 157, 219, 0.3)',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  clearButton: {
    padding: 5,
  },
  listContainer: {
    paddingTop: 5,
    paddingBottom: 20,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    marginHorizontal: 10,
    marginVertical: 5,
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(179, 157, 219, 0.3)',
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
    borderWidth: 2,
    borderColor: '#B39DDB',
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#B39DDB',
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
    backgroundColor: '#FF4081',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: 'rgba(30, 7, 55, 0.7)',
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
    color: '#D1C4E9',
    maxWidth: '80%',
    fontFamily: 'monospace',
  },
  unreadChatName: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
  chatTime: {
    fontSize: 12,
    color: '#B39DDB',
    fontFamily: 'monospace',
  },
  unreadChatTime: {
    color: '#FF4081',
  },
  chatMessage: {
    fontSize: 14,
    color: '#B39DDB',
    marginRight: 20,
    fontFamily: 'monospace',
  },
  unreadChatMessage: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
    color: '#D1C4E9',
    fontFamily: 'monospace',
  },
  emptyText: {
    fontSize: 16,
    color: '#B39DDB',
    textAlign: 'center',
    marginBottom: 30,
    maxWidth: '80%',
    fontFamily: 'monospace',
  },
  emptyButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  emptyButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  clearSearchButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#B39DDB',
  },
  clearSearchButtonText: {
    color: '#B39DDB',
    fontWeight: '600',
    fontSize: 16,
    fontFamily: 'monospace',
  },
  starsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  star: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
});