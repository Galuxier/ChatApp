import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, FlatList, Text } from 'react-native';
import { collection, addDoc, onSnapshot, query, orderBy, DocumentData } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';

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

  const chatId = [auth.currentUser!.uid, userId].sort().join('_');

  useEffect(() => {
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as DocumentData) } as Message)));
    });
    return () => unsubscribe();
  }, [chatId]);

  const sendMessage = async () => {
    if (message.trim()) {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: message,
        senderId: auth.currentUser!.uid,
        timestamp: new Date(),
        status: 'sent'
      });
      setMessage('');
    }
  };

  return (
    <View>
      <FlatList
        data={messages}
        renderItem={({ item }) => (
          <Text>{item.senderId === auth.currentUser!.uid ? 'You' : 'Other'}: {item.text} ({item.status})</Text>
        )}
        keyExtractor={item => item.id}
      />
      <TextInput value={message} onChangeText={setMessage} placeholder="Type a message" />
      <Button title="Send" onPress={sendMessage} />
    </View>
  );
}