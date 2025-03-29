import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { router } from 'expo-router';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pingId, setPingId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Function to check PingID availability
  const checkPingIdAvailability = async (id: string) => {
    try {
      const q = query(collection(db, 'users'), where('pingId', '==', id));
      const querySnapshot = await getDocs(q);
      
      return { available: querySnapshot.empty };
    } catch (error) {
      console.error('Error checking Ping ID:', error);
      return { available: false, error: (error as Error).message };
    }
  };

  const handleRegister = async () => {
    // Reset error state
    setError('');
    
    // Basic validation
    if (!email || !password || !displayName || !pingId) {
      setError('All fields are required');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    if (pingId.includes(' ') || pingId.length < 4) {
      setError('Ping ID must be at least 4 characters and cannot contain spaces');
      return;
    }

    setIsLoading(true);

    try {
      // Check if pingId is already taken
      const pingIdCheckResult = await checkPingIdAvailability(pingId);
      if (!pingIdCheckResult.available) {
        setError('This Ping ID is already taken. Please choose another one.');
        setIsLoading(false);
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
      
      // Navigation will be handled by index.tsx redirect
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(
        errorMessage.includes('email-already-in-use')
          ? 'This email is already registered'
          : 'Registration failed. Please try again.'
      );
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Join Ping and connect with friends</Text>
      
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      
      <View style={styles.inputContainer}>
        <TextInput 
          style={styles.input} 
          placeholder="Display Name" 
          value={displayName} 
          onChangeText={setDisplayName} 
          editable={!isLoading}
        />
        <TextInput 
          style={styles.input} 
          placeholder="Ping ID (unique username)" 
          value={pingId} 
          onChangeText={setPingId}
          autoCapitalize="none"
          editable={!isLoading}
        />
        <TextInput 
          style={styles.input} 
          placeholder="Email" 
          value={email} 
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!isLoading}
        />
        <TextInput 
          style={styles.input} 
          placeholder="Password" 
          value={password} 
          onChangeText={setPassword} 
          secureTextEntry 
          editable={!isLoading}
        />
      </View>
      
      <TouchableOpacity 
        style={styles.registerButton} 
        onPress={handleRegister}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.buttonText}>Register</Text>
        )}
      </TouchableOpacity>
      
      <View style={styles.loginContainer}>
        <Text style={styles.loginText}>Already have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/login')} disabled={isLoading}>
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
    marginBottom: 20,
    color: '#7f8c8d',
  },
  errorText: {
    color: '#e74c3c',
    marginBottom: 20,
    textAlign: 'center',
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