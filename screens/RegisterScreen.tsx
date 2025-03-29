import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../App';

type RegisterScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Register'>;

interface Props {
  navigation: RegisterScreenNavigationProp;
}

export default function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [pingId, setPingId] = useState<string>('');

  const handleRegister = async () => {
    // Basic validation
    if (!email || !password || !displayName || !pingId) {
      alert('All fields are required');
      return;
    }
    
    if (pingId.includes(' ') || pingId.length < 4) {
      alert('Ping ID must be at least 4 characters and cannot contain spaces');
      return;
    }

    try {
      // Check if pingId is already taken
      const pingIdCheckResult = await checkPingIdAvailability(pingId);
      if (!pingIdCheckResult.available) {
        alert('This Ping ID is already taken. Please choose another one.');
        return;
      }

      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Update profile with displayName
      await updateProfile(user, { displayName });
      
      // Save user data to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        displayName: displayName,
        email: email,
        pingId: pingId,
        createdAt: new Date(),
      });
      
      navigation.navigate('ChatList');
    } catch (error) {
      alert((error as Error).message);
    }
  };

  // Function to check PingID availability
  const checkPingIdAvailability = async (id: string) => {
    try {
      // In a real app, you would check against a Firestore collection of pingIds
      // For now, let's assume it's available if it's not empty
      return { available: Boolean(id) };
    } catch (error) {
      console.error('Error checking Ping ID:', error);
      return { available: false, error: (error as Error).message };
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Join Ping and connect with friends</Text>
      
      <View style={styles.inputContainer}>
        <TextInput 
          style={styles.input} 
          placeholder="Display Name" 
          value={displayName} 
          onChangeText={setDisplayName} 
        />
        <TextInput 
          style={styles.input} 
          placeholder="Ping ID (unique username)" 
          value={pingId} 
          onChangeText={setPingId}
          autoCapitalize="none"
        />
        <TextInput 
          style={styles.input} 
          placeholder="Email" 
          value={email} 
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput 
          style={styles.input} 
          placeholder="Password" 
          value={password} 
          onChangeText={setPassword} 
          secureTextEntry 
        />
      </View>
      
      <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
        <Text style={styles.buttonText}>Register</Text>
      </TouchableOpacity>
      
      <View style={styles.loginContainer}>
        <Text style={styles.loginText}>Already have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginLink}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#3498db',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    color: '#7f8c8d',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 5,
    padding: 15,
    marginBottom: 15,
    width: '100%',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  registerButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 5,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loginContainer: {
    flexDirection: 'row',
    marginTop: 20,
  },
  loginText: {
    color: '#7f8c8d',
  },
  loginLink: {
    color: '#3498db',
    fontWeight: 'bold',
  },
});