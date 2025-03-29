import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Text, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { updateProfile, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { useAuth } from '../../context/auth';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

export default function ProfileScreen() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState<string>(user?.displayName || '');
  const [pingId, setPingId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setPingId(userData.pingId || '');
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchUserData();
  }, [user]);

  const handleUpdate = async () => {
    if (!user) return;
    
    if (!displayName.trim()) {
      Alert.alert('Error', 'Display name cannot be empty');
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Update Firebase Auth profile
      await updateProfile(user, { displayName });
      
      // Update Firestore user document
      await setDoc(doc(db, 'users', user.uid), { 
        displayName 
      }, { merge: true });
      
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = async () => {
    if (pingId) {
      await Clipboard.setStringAsync(pingId);
      Alert.alert('Copied', 'Your Ping ID has been copied to clipboard');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          onPress: async () => {
            try {
              await signOut(auth);
              // Navigation will be handled by index.tsx redirect
            } catch (error) {
              console.error('Error during logout:', error);
            }
          },
          style: 'destructive'
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Profile</Text>
      
      <View style={styles.infoContainer}>
        <View style={styles.infoItem}>
          <Text style={styles.label}>Your Ping ID</Text>
          <View style={styles.pingIdContainer}>
            <Text style={styles.pingId}>{pingId}</Text>
            <TouchableOpacity onPress={copyToClipboard}>
              <Text style={styles.copyText}>Copy</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.infoText}>Share this ID with friends to let them add you</Text>
        </View>
        
        <View style={styles.separator} />
        
        <View style={styles.infoItem}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your display name"
          />
        </View>
      </View>
      
      <TouchableOpacity 
        style={styles.updateButton} 
        onPress={handleUpdate}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.buttonText}>Update Profile</Text>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.logoutButton} 
        onPress={handleLogout}
      >
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#2c3e50',
  },
  infoContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  infoItem: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2c3e50',
  },
  pingIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ecf0f1',
    padding: 15,
    borderRadius: 5,
    marginBottom: 5,
  },
  pingId: {
    fontSize: 16,
    color: '#34495e',
  },
  copyText: {
    color: '#3498db',
    fontWeight: 'bold',
  },
  infoText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 5,
  },
  input: {
    backgroundColor: '#ecf0f1',
    borderRadius: 5,
    padding: 15,
    width: '100%',
  },
  separator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 15,
  },
  updateButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  logoutButton: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e74c3c',
  },
  logoutButtonText: {
    color: '#e74c3c',
    fontWeight: 'bold',
    fontSize: 16,
  },
});