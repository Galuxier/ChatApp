import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  FlatList,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  Image,
  ImageBackground,
  Animated,
  Dimensions,
} from 'react-native';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  DocumentData,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  where,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../../context/auth';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: Date;
  status: string;
}

export default function ChatScreen() {
  const { id: userId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [message, setMessage] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [friendName, setFriendName] = useState<string>('');
  const [friendImage, setFriendImage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const flatListRef = useRef<FlatList>(null);

  const chatId = user && userId ? [user.uid, userId].sort().join('_') : '';

  // Animation for stars
  const stars = [...Array(20)].map(() => ({
    top: Math.random() * height,
    left: Math.random() * width,
    size: Math.random() * 3 + 1,
    opacity: new Animated.Value(Math.random() * 0.5 + 0.1),
    duration: Math.random() * 2000 + 1000,
  }));

  // Function to ensure chat exists in database
  const ensureChatExists = async () => {
    if (!user || !userId) return;

    const currentUserId = user.uid;
    const friendId = userId;
    const chatId = [currentUserId, friendId].sort().join('_');

    await Promise.all([
      setDoc(
        doc(db, 'userChats', `${currentUserId}_${chatId}`),
        {
          userId: currentUserId,
          chatId: chatId,
          friendId: friendId,
          createdAt: new Date(),
        },
        { merge: true }
      ),
      setDoc(
        doc(db, 'userChats', `${friendId}_${chatId}`),
        {
          userId: friendId,
          chatId: chatId,
          friendId: currentUserId,
          createdAt: new Date(),
        },
        { merge: true }
      ),
      setDoc(
        doc(db, 'chats', chatId),
        {
          participants: [currentUserId, friendId],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { merge: true }
      ),
    ]);
  };

  // Get friend's information
  useEffect(() => {
    const fetchFriendData = async () => {
      if (!user || !userId) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setFriendName(userData.displayName || 'Unknown Contact');
          setFriendImage(userData.profileImage || null);
        }
        await ensureChatExists();
      } catch (error) {
        console.error('Error fetching friend data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFriendData();

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
  }, [userId, user]);

  // Function to mark all unread messages as read
  const markMessagesAsRead = useCallback(async () => {
    if (!user || !chatId) return;

    try {
      const unreadQuery = query(
        collection(db, 'chats', chatId, 'messages'),
        where('senderId', '!=', user.uid)
      );

      const unreadSnapshot = await getDocs(unreadQuery);

      if (!unreadSnapshot.empty) {
        const batch = writeBatch(db);

        unreadSnapshot.docs
          .filter(doc => doc.data().status !== 'read')
          .forEach(doc => {
            batch.update(doc.ref, { status: 'read' });
          });

        await batch.commit();
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [user, chatId]);

  // Listen for messages and mark them as read when viewed
  useEffect(() => {
    if (!user || !chatId) return;

    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const newMessages = snapshot.docs.map(
          doc =>
            ({
              id: doc.id,
              ...(doc.data() as DocumentData),
              timestamp: doc.data().timestamp?.toDate() || new Date(),
            } as Message)
        );

        setMessages(newMessages);
        setLoading(false);

        // Mark received messages as read
        markMessagesAsRead();
      },
      error => {
        console.error('Error listening to messages:', error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [chatId, user, markMessagesAsRead]);

  const sendMessage = async () => {
    if (!user || !chatId || !message.trim()) return;

    const newMessage = {
      text: message,
      senderId: user.uid,
      timestamp: new Date(),
      status: 'sent',
    };

    setMessage('');

    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), newMessage);

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: message.trim(),
        lastMessageTime: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && !loading) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, loading]);

  // Format timestamp to readable time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Group messages by date for date headers
  const getMessageDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Add date headers
  const messagesWithDateSeparators = () => {
    const result: (Message | { id: string; type: string; date: string })[] = [];
    let currentDate = '';

    messages.forEach((message, index) => {
      const messageDate = getMessageDate(message.timestamp);

      if (messageDate !== currentDate) {
        currentDate = messageDate;
        result.push({
          id: `date-${index}`,
          type: 'date',
          date: messageDate,
        });
      }

      result.push(message);
    });

    return result;
  };

  if (loading) {
    return (
      <ImageBackground 
        source={{ uri: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=1000' }} 
        style={styles.backgroundImage}
      >
        <LinearGradient
          colors={['rgba(0, 15, 36, 0.9)', 'rgba(10, 25, 47, 0.95)']}
          style={styles.gradient}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00DDEB" />
            <Text style={styles.loadingText}>Connecting to Comm System...</Text>
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
        colors={['rgba(0, 15, 36, 0.9)', 'rgba(10, 25, 47, 0.95)']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <FontAwesome name="arrow-left" size={20} color="#00DDEB" />
            </TouchableOpacity>

            <View style={styles.headerProfile}>
              {friendImage ? (
                <Image source={{ uri: friendImage }} style={styles.profileImage} />
              ) : (
                <LinearGradient
                  colors={['#00DDEB', '#1E90FF']}
                  style={styles.profileImage}
                >
                  <Text style={styles.profileImageText}>{friendName.charAt(0).toUpperCase()}</Text>
                </LinearGradient>
              )}
              <Text style={styles.headerTitle}>{friendName}</Text>
              <Text style={styles.headerStatus}>Online</Text>
            </View>
          </View>

          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
            <FlatList
              ref={flatListRef}
              data={messagesWithDateSeparators()}
              renderItem={({ item }) => {
                // Date separator
                if ('type' in item && item.type === 'date') {
                  return (
                    <View style={styles.dateSeparator}>
                      <View style={styles.dateLine} />
                      <Text style={styles.dateText}>{item.date}</Text>
                      <View style={styles.dateLine} />
                    </View>
                  );
                }

                // Regular message
                const message = item as Message;
                const isMine = message.senderId === user?.uid;

                return (
                  <View
                    style={[styles.messageContainer, isMine ? styles.myMessageContainer : styles.theirMessageContainer]}
                  >
                    <View style={[styles.messageBubble, isMine ? styles.myMessage : styles.theirMessage]}>
                      <Text style={[styles.messageText, isMine ? styles.myMessageText : styles.theirMessageText]}>
                        {message.text}
                      </Text>
                      <View style={styles.messageFooter}>
                        <Text style={[styles.timeText, isMine ? styles.myTimeText : styles.theirTimeText]}>
                          {formatTime(message.timestamp)}
                        </Text>
                        {isMine && (
                          <Text
                            style={[
                              styles.statusText,
                              message.status === 'read' ? styles.readStatus : styles.sentStatus,
                            ]}
                          >
                            {message.status === 'read' ? '✓✓' : '✓'}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                );
              }}
              keyExtractor={item => ('id' in item ? item.id : item.type + item.date)}
              contentContainerStyle={styles.messagesList}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Image source={{ uri: 'https://via.placeholder.com/150' }} style={styles.emptyImage} />
                  <Text style={styles.emptyTitle}>No transmissions yet</Text>
                  <Text style={styles.emptyText}>Send a signal to initiate contact</Text>
                </View>
              }
            />

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={message}
                onChangeText={setMessage}
                placeholder="Enter transmission..."
                placeholderTextColor="#A0B1C2"
                multiline
              />
              <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                <LinearGradient
                  colors={['#00DDEB', '#1E90FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sendButtonGradient}
                >
                  <FontAwesome name="send" size={18} color="white" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>

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

          {/* Radar effect */}
          <View style={styles.radarContainer}>
            <View style={styles.radarCircle} />
            <View style={[styles.radarCircle, styles.radarPulse]} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#00DDEB',
    fontSize: 16,
    marginTop: 10,
    fontFamily: 'monospace',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingTop: Platform.OS === 'android' ? 35 : 15,
    backgroundColor: 'rgba(10, 25, 47, 0.9)',
    borderBottomWidth: 2,
    borderBottomColor: '#00DDEB',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#00DDEB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  headerStatus: {
    fontSize: 12,
    color: '#00FF7F',
    marginLeft: 10,
    fontFamily: 'monospace',
  },
  keyboardAvoid: {
    flex: 1,
  },
  messagesList: {
    padding: 10,
    paddingBottom: 20,
  },
  messageContainer: {
    marginVertical: 5,
    paddingHorizontal: 10,
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
  },
  theirMessageContainer: {
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  messageBubble: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 6,
    backgroundColor: 'rgba(10, 25, 47, 0.9)',
    borderWidth: 1,
    borderColor: '#00DDEB',
  },
  myMessage: {
    backgroundColor: 'rgba(0, 221, 235, 0.2)',
    borderColor: '#00DDEB',
  },
  theirMessage: {
    backgroundColor: 'rgba(30, 144, 255, 0.2)',
    borderColor: '#1E90FF',
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
    lineHeight: 22,
    fontFamily: 'monospace',
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  theirMessageText: {
    color: '#E6F0FA',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 11,
    marginRight: 4,
    fontFamily: 'monospace',
  },
  myTimeText: {
    color: '#A0B1C2',
  },
  theirTimeText: {
    color: '#A0B1C2',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  sentStatus: {
    color: '#00DDEB',
  },
  readStatus: {
    color: '#00FF7F',
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 15,
    marginHorizontal: 10,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#00DDEB',
    opacity: 0.3,
  },
  dateText: {
    fontSize: 12,
    color: '#00DDEB',
    marginHorizontal: 10,
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(10, 25, 47, 0.9)',
    borderTopWidth: 2,
    borderTopColor: '#00DDEB',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 100,
    marginHorizontal: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#00DDEB',
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  sendButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    height: 400,
  },
  emptyImage: {
    width: 120,
    height: 120,
    opacity: 0.5,
    marginBottom: 20,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#00DDEB',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  emptyText: {
    fontSize: 16,
    color: '#A0B1C2',
    textAlign: 'center',
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
  radarContainer: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#00DDEB',
    opacity: 0.5,
    position: 'absolute',
  },
  radarPulse: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#00DDEB',
    opacity: 0.3,
    animation: 'pulse 2s infinite',
  },
});
