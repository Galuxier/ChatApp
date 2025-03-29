import React, { useState, useEffect, useRef } from 'react';
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
  SafeAreaView
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
  setDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../AuthHandler';

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;

interface Props {
  route: ChatScreenRouteProp;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: Date;
  status: string;
}

export default function ChatScreen({ route }: Props) {
  const { userId } = route.params;
  const [message, setMessage] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [friendName, setFriendName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const flatListRef = useRef<FlatList>(null);

  const chatId = [auth.currentUser!.uid, userId].sort().join('_');
  
  // Function to ensure chat exists in database
  const ensureChatExists = async () => {
    if (!auth.currentUser) return;
    
    const currentUserId = auth.currentUser.uid;
    const friendId = userId;
    const chatId = [currentUserId, friendId].sort().join('_');
    
    await Promise.all([
      setDoc(doc(db, 'userChats', `${currentUserId}_${chatId}`), {
        userId: currentUserId,
        chatId: chatId,
        friendId: friendId,
        createdAt: new Date()
      }, { merge: true }),
      
      setDoc(doc(db, 'userChats', `${friendId}_${chatId}`), {
        userId: friendId,
        chatId: chatId,
        friendId: currentUserId,
        createdAt: new Date()
      }, { merge: true }),
      
      // Ensure chat document exists
      setDoc(doc(db, 'chats', chatId), {
        participants: [currentUserId, friendId],
        createdAt: new Date(),
        updatedAt: new Date()
      }, { merge: true })
    ]);
  };

  // Get friend's name
  useEffect(() => {
    const fetchFriendData = async () => {
      if (!auth.currentUser) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setFriendName(userDoc.data().displayName || 'Chat');
        }
        // Ensure chat record exists when entering chat screen
        await ensureChatExists();
      } catch (error) {
        console.error('Error fetching friend data:', error);
      }
    };
    
    fetchFriendData();
  }, [userId]);

  // Listen for messages
  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(
      collection(db, 'chats', chatId, 'messages'), 
      orderBy('timestamp', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...(doc.data() as DocumentData),
        timestamp: doc.data().timestamp?.toDate() || new Date() 
      } as Message));
      
      setMessages(newMessages);
      setLoading(false);
      
      // Mark received messages as read
      snapshot.docs.forEach(doc => {
        const messageData = doc.data();
        if (
          messageData.senderId !== auth.currentUser?.uid && 
          messageData.status !== 'read'
        ) {
          updateDoc(doc.ref, { status: 'read' });
        }
      });
    }, (error) => {
      console.error('Error listening to messages:', error);
      setLoading(false);
    });
    
    return () => {
      // Make sure to unsubscribe when component unmounts
      unsubscribe();
    };
  }, [chatId]);

  const sendMessage = async () => {
    if (!auth.currentUser || !message.trim()) return;
    
    const newMessage = {
      text: message,
      senderId: auth.currentUser.uid,
      timestamp: new Date(),
      status: 'sent'
    };
    
    setMessage('');
    
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), newMessage);
      
      // Update last message in chat document
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: message.trim(),
        lastMessageTime: new Date(),
        updatedAt: new Date()
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
      hour12: true 
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={({ item }) => {
            const isMine = item.senderId === auth.currentUser!.uid;
            
            return (
              <View style={[
                styles.messageContainer,
                isMine ? styles.myMessageContainer : styles.theirMessageContainer
              ]}>
                <View style={[
                  styles.messageBubble,
                  isMine ? styles.myMessage : styles.theirMessage
                ]}>
                  <Text style={styles.messageText}>{item.text}</Text>
                  <View style={styles.messageFooter}>
                    <Text style={styles.timeText}>{formatTime(item.timestamp)}</Text>
                    {isMine && (
                      <Text style={styles.statusText}>
                        {item.status === 'read' ? '✓✓' : '✓'}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesList}
        />
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            placeholder="Type a message..."
            multiline
          />
          <TouchableOpacity 
            style={styles.sendButton}
            onPress={sendMessage}
            disabled={message.trim() === ''}
          >
            <Text style={styles.sendButtonText}>Send</Text>
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
  keyboardAvoid: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingVertical: 15,
    paddingHorizontal: 10,
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
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingBottom: 5,
  },
  myMessage: {
    backgroundColor: '#3498db',
  },
  theirMessage: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageText: {
    fontSize: 16,
    color: 'black',
    marginBottom: 5,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 10,
    color: '#7f8c8d',
    marginRight: 5,
  },
  statusText: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#3498db',
    borderRadius: 20,
    paddingHorizontal: 15,  
    paddingVertical: 10,
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});