import React, { useState } from 'react';
import { View, TextInput, Button } from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore'; // เพิ่มการ import setDoc
import { auth, db } from '../firebase';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const handleLogin = () => {
    signInWithEmailAndPassword(auth, email, password)
      .then(() => navigation.navigate('UserList'))
      .catch(error => alert(error.message));
  };

  const handleRegister = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      // บันทึกข้อมูลผู้ใช้ลง Firestore
      await setDoc(doc(db, 'users', user.uid), {
        displayName: email.split('@')[0], // ใช้ส่วนแรกของ email เป็น displayName ชั่วคราว
        email: email,
      });
      navigation.navigate('UserList');
    } catch (error) {
      alert((error as Error).message);
    }
  };

  return (
    <View>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} />
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <Button title="Login" onPress={handleLogin} />
      <Button title="Register" onPress={handleRegister} />
    </View>
  );
}