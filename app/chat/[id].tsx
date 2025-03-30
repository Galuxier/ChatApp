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

const { width } = Dimensions.get('window');

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
          setFriendName(userData.displayName || 'Chat');
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with gradient */}
      <LinearGradient colors={['#3498db', '#2980b9']} style={styles.headerGradient}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <FontAwesome name="arrow-left" size={20} color="white" />
          </TouchableOpacity>

          <View style={styles.headerProfile}>
            {friendImage ? (
              <Image source={{ uri: friendImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.profileImageText}>{friendName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.headerTitle}>{friendName}</Text>
          </View>
        </View>
      </LinearGradient>

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
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>Send a message to start the conversation</Text>
            </View>
          }
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            placeholder="Type a message..."
            multiline
            placeholderTextColor="#95a5a6"
          />

          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <LinearGradient colors={['#3498db', '#2980b9']} style={styles.sendButtonGradient}>
              <FontAwesome name="send" size={18} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerGradient: {
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingTop: Platform.OS === 'android' ? 35 : 15,
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
    borderColor: 'white',
  },
  profileImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'white',
  },
  profileImageText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  keyboardAvoid: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 10,
    paddingBottom: 20,
  },
  messageContainer: {
    marginVertical: 2,
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
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  myMessage: {
    backgroundColor: '#3498db',
    borderTopRightRadius: 2,
  },
  theirMessage: {
    backgroundColor: 'white',
    borderTopLeftRadius: 2,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
    lineHeight: 22,
  },
  myMessageText: {
    color: 'white',
  },
  theirMessageText: {
    color: '#34495e',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 11,
    marginRight: 4,
  },
  myTimeText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  theirTimeText: {
    color: '#95a5a6',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  sentStatus: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  readStatus: {
    color: '#2ecc71',
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
    backgroundColor: '#e0e0e0',
  },
  dateText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginHorizontal: 10,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  input: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 100,
    marginHorizontal: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ebebeb',
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
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#34495e',
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
  },
});