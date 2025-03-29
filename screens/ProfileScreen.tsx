import React, { useState } from 'react';
import { View, TextInput, Button } from 'react-native';
import { updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function ProfileScreen() {
  const [displayName, setDisplayName] = useState<string>(auth.currentUser?.displayName || '');

  const handleUpdate = async () => {
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName });
      await setDoc(doc(db, 'users', auth.currentUser.uid), { displayName }, { merge: true });
      alert('Profile updated!');
    }
  };

  return (
    <View>
      <TextInput value={displayName} onChangeText={setDisplayName} placeholder="Display Name" />
      <Button title="Update Profile" onPress={handleUpdate} />
    </View>
  );
}