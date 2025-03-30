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
  const [isSending, setIsSending] = useState<boolean>(false);
  const flatListRef = useRef<FlatList>(null);
  const sendButtonScale = useRef(new Animated.Value(1)).current;
  const sendButtonOpacity = useRef(new Animated.Value(0.8)).current;

  const chatId = user && userId ? [user.uid, userId].sort().join('_') : '';

  // Animation for stars
  const stars = [...Array(20)].map(() => ({
    top: Math.random() * height,
    left: Math.random() * width,
    size: Math.random() * 3 + 1,
    opacity: new Animated.Value(Math.random() * 0.5 + 0.1),
    duration: Math.random() * 2000 + 1000,
  }));

  // Signal beam animation
  const signalOpacity = useRef(new Animated.Value(0)).current;
  const signalPosition = useRef(new Animated.Value(0)).current;

  const animateSignalBeam = () => {
    signalPosition.setValue(0);
    signalOpacity.setValue(0.8);
    
    Animated.parallel([
      Animated.timing(signalPosition, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.timing(signalOpacity, {
        toValue: 0,
        duration: 1500,
        useNativeDriver: true,
      }),
    ]).start();
  };

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

    setIsSending(true);
    
    // Animate send button
    Animated.sequence([
      Animated.timing(sendButtonScale, {
        toValue: 1.2,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(sendButtonScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start();
    
    // Start signal beam animation
    animateSignalBeam();

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
    } finally {
      setIsSending(false);
    }
  };

  // Handle button press effect
  const handleSendButtonPressIn = () => {
    Animated.parallel([
      Animated.timing(sendButtonScale, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(sendButtonOpacity, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      })
    ]).start();
  };

  const handleSendButtonPressOut = () => {
    Animated.parallel([
      Animated.timing(sendButtonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(sendButtonOpacity, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      })
    ]).start();
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
            <Text style={styles.loadingText}>Establishing Secure Connection...</Text>
            <View style={styles.loadingSubtext}>
              <Text style={styles.scanningText}>SCANNING</Text>
              <View style={styles.loadingDots}>
                <Text style={styles.loadingDot}>.</Text>
                <Text style={styles.loadingDot}>.</Text>
                <Text style={styles.loadingDot}>.</Text>
              </View>
            </View>
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
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>{friendName}</Text>
                <View style={styles.statusContainer}>
                  <View style={styles.statusDot} />
                  <Text style={styles.headerStatus}>COMMS ONLINE</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.connectionIndicator}>
              <Text style={styles.signalText}>SIGNAL</Text>
              <View style={styles.signalBars}>
                <View style={[styles.signalBar, styles.signalBarActive]} />
                <View style={[styles.signalBar, styles.signalBarActive]} />
                <View style={[styles.signalBar, styles.signalBarActive]} />
              </View>
            </View>
          </View>

          <View style={styles.topGridOverlay} />

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
                  <View style={styles.emptyIconContainer}>
                    <FontAwesome name="satellite" size={50} color="#00DDEB" />
                  </View>
                  <Text style={styles.emptyTitle}>COMMUNICATION CHANNEL OPEN</Text>
                  <Text style={styles.emptyText}>Send a transmission to initiate contact</Text>
                  <View style={styles.gridContainer}>
                    <View style={styles.gridLine} />
                    <View style={styles.gridLine} />
                    <View style={styles.gridLine} />
                  </View>
                </View>
              }
            />

            <View style={styles.bottomGridOverlay} />

            <View style={styles.inputContainer}>
              {/* Signal beam animation */}
              <Animated.View 
                style={[
                  styles.signalBeam,
                  {
                    opacity: signalOpacity,
                    transform: [
                      {
                        translateX: signalPosition.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -300],
                        }),
                      },
                    ],
                  },
                ]}
              />
              
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="TYPE TRANSMISSION..."
                  placeholderTextColor="#638899"
                  multiline
                />
              </View>
              
              <TouchableOpacity 
                onPress={sendMessage}
                onPressIn={handleSendButtonPressIn}
                onPressOut={handleSendButtonPressOut}
                disabled={!message.trim() || isSending}
                activeOpacity={0.7}
              >
                <Animated.View 
                  style={[
                    styles.sendButtonContainer,
                    {
                      transform: [{ scale: sendButtonScale }],
                      opacity: !message.trim() ? 0.5 : sendButtonOpacity,
                    }
                  ]}
                >
                  <LinearGradient
                    colors={['#00DDEB', '#0066BB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.sendButtonGradient}
                  >
                    {isSending ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <View style={styles.sendButtonInner}>
                        <FontAwesome name="rocket" size={18} color="white" />
                      </View>
                    )}
                  </LinearGradient>
                  <View style={styles.buttonRingEffect} />
                </Animated.View>
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
            <View style={[styles.radarCircle, styles.radarMidCircle]} />
            <View style={[styles.radarCircle, styles.radarOuterCircle]} />
            <View style={styles.radarSweep} />
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
    letterSpacing: 1,
  },
  loadingSubtext: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  scanningText: {
    color: '#00DDEB',
    fontSize: 14,
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  loadingDots: {
    flexDirection: 'row',
    height: 20,
    overflow: 'hidden',
  },
  loadingDot: {
    color: '#00DDEB',
    fontSize: 24,
    marginLeft: 2,
    fontFamily: 'monospace',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingTop: Platform.OS === 'android' ? 35 : 15,
    backgroundColor: 'rgba(0, 10, 25, 0.9)',
    borderBottomWidth: 2,
    borderBottomColor: '#00DDEB',
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
  headerTextContainer: {
    marginLeft: 10,
  },
  profileImage: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    borderWidth: 2,
    borderColor: '#00DDEB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00FF7F',
    marginRight: 5,
  },
  headerStatus: {
    fontSize: 10,
    color: '#00FF7F',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  connectionIndicator: {
    alignItems: 'center',
  },
  signalText: {
    fontSize: 9,
    color: '#00DDEB',
    fontFamily: 'monospace',
    letterSpacing: 1,
    marginBottom: 4,
  },
  signalBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  signalBar: {
    width: 4,
    height: 8,
    marginHorizontal: 1,
    backgroundColor: 'rgba(0, 221, 235, 0.3)',
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },
  signalBarActive: {
    backgroundColor: '#00DDEB',
    height: 15,
  },
  topGridOverlay: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 90 : 70,
    left: 0,
    right: 0,
    height: 50,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0, 221, 235, 0.1)',
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  bottomGridOverlay: {
    height: 50,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0, 221, 235, 0.1)',
    marginBottom: -1,
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
  },
  myMessage: {
    backgroundColor: 'rgba(0, 221, 235, 0.15)',
    borderColor: '#00DDEB',
  },
  theirMessage: {
    backgroundColor: 'rgba(30, 144, 255, 0.15)',
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
    letterSpacing: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 10, 25, 0.9)',
    borderTopWidth: 2,
    borderTopColor: '#00DDEB',
    position: 'relative',
    overflow: 'hidden',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00DDEB',
    marginRight: 10,
    paddingHorizontal: 5,
  },
  input: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  sendButtonContainer: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  sendButtonGradient: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  sendButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonRingEffect: {
    position: 'absolute',
    width: 55,
    height: 55,
    borderRadius: 27.5,
    borderWidth: 1,
    borderColor: 'rgba(0, 221, 235, 0.5)',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    height: 400,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#00DDEB',
    borderRadius: 60,
    marginBottom: 20,
    backgroundColor: 'rgba(0, 221, 235, 0.05)',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#00DDEB',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  emptyText: {
    fontSize: 14,
    color: '#A0B1C2',
    textAlign: 'center',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  gridContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
  },
  gridLine: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: '#00DDEB',
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
    bottom: 100,
    right: 20,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#00DDEB',
    opacity: 0.5,
    position: 'absolute',
  },
  radarMidCircle: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    opacity: 0.3,
  },
  radarOuterCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    opacity: 0.2,
  },
  radarSweep: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderTopColor: '#00DDEB',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    opacity: 0.7,
    transform: [{ rotate: '135deg' }],
  },
  signalBeam: {
    position: 'absolute',
    width: 300,
    height: 2,
    backgroundColor: '#00DDEB',
    top: '50%',
    right: 50,
    opacity: 0,
  },
})