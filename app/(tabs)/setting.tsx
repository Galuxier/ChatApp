import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  StatusBar,
  SafeAreaView,
  ImageBackground,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { updateProfile, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { auth, db, storage } from '../../firebase';
import { useAuth } from '../../context/auth';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function ProfileScreen() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState<string>(user?.displayName || '');
  const [pingId, setPingId] = useState<string>('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [email, setEmail] = useState<string>(user?.email || '');
  const [memberSince, setMemberSince] = useState<string>('');

  // Animation for stars
  const stars = [...Array(20)].map(() => ({
    top: Math.random() * height,
    left: Math.random() * width,
    size: Math.random() * 3 + 1,
    opacity: new Animated.Value(Math.random() * 0.5 + 0.1),
    duration: Math.random() * 2000 + 1000,
  }));

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setPingId(userData.pingId || '');
            setProfileImage(userData.profileImage || null);
            setEmail(user.email || '');
            
            if (userData.createdAt) {
              const date = userData.createdAt.toDate();
              setMemberSince(date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              }));
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          if (error instanceof Error) {
            Alert.alert('Error', `Failed to load profile data: ${error.message}`);
          }
        } finally {
          setIsLoading(false);
        }
      }
    };
  
    fetchUserData();

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
  }, [user]);

  const pickImage = async () => {
    try {
      // Request permissions first
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Access to media library is required to upload your profile image.');
          return;
        }
      }
    
      // Use simple string for mediaTypes to avoid deprecation warning
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images', 
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });
    
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        await uploadImage(selectedAsset.uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Could not select image.');
    }
  };
  
  const uploadImage = async (uri: string) => {
    if (!user) return;
  
    setIsUploadingImage(true);
  
    try {
      const fileName = `profile_${user.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storage, `profileImages/${fileName}`);
  
      console.log("Starting upload with reference:", storageRef.fullPath);
  
      // แปลง URI เป็น Blob
      const response = await fetch(uri);
      const blob = await response.blob();
  
      // ใช้ uploadBytesResumable เพื่อรองรับ progress tracking
      const uploadTask = uploadBytesResumable(storageRef, blob);
      console.log("Firebase Storage instance:", storage);
      console.log("Firebase Auth user:", user);
      uploadTask.on('state_changed',
        (snapshot) => {
          // สามารถเพิ่ม progress bar ได้ที่นี่
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`Upload is ${progress}% done`);
        },
        (error) => {
          console.error("Upload error:", error);
          Alert.alert("Error", `Upload failed: ${error.message}`);
        },
        async () => {
          // อัปโหลดสำเร็จ ดึง URL มาใช้
          const downloadURL = await getDownloadURL(storageRef);
          console.log("Download URL:", downloadURL);
  
          await setDoc(doc(db, 'users', user.uid), {
            profileImage: downloadURL
          }, { merge: true });
  
          setProfileImage(downloadURL);
          Alert.alert("Success", "Profile picture updated successfully");
        }
      );
    } catch (error) {
      console.error("Error uploading image:", error);
      Alert.alert("Error", "Failed to upload profile picture.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleUpdate = async () => {
    if (!user) return;
    
    if (!displayName.trim()) {
      Alert.alert('Error', 'Display name cannot be empty');
      return;
    }
    
    setIsSaving(true);
    
    try {
      await updateProfile(user, { displayName });
      await setDoc(doc(db, 'users', user.uid), { 
        displayName 
      }, { merge: true });
      
      Alert.alert('Update Complete', 'Profile settings updated successfully');
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = async () => {
    if (pingId) {
      await Clipboard.setStringAsync(pingId);
      Alert.alert('Copied', 'Your Ping ID has been copied to the galaxy clipboard');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Disconnect',
      'Are you sure you want to disconnect from the galaxy?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Disconnect', 
          onPress: async () => {
            try {
              await signOut(auth);
              setTimeout(() => {
                router.replace('/login');
              }, 100);
            } catch (error) {
              console.error('Error during disconnect:', error);
              Alert.alert('Error', 'Failed to disconnect. Please try again.');
            }
          },
          style: 'destructive'
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <ImageBackground 
        source={{ uri: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=1000' }} 
        style={styles.backgroundImage}
      >
        <LinearGradient
          colors={['rgba(45, 13, 83, 0.7)', 'rgba(76, 41, 122, 0.85)', 'rgba(30, 7, 55, 0.95)']}
          style={styles.gradient}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#B39DDB" />
            <Text style={styles.loadingText}>Accessing Profile Data...</Text>
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
        colors={['rgba(45, 13, 83, 0.7)', 'rgba(76, 41, 122, 0.85)', 'rgba(30, 7, 55, 0.95)']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" />
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.container}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Profile Settings</Text>
              </View>
              
              <View style={styles.profileImageSection}>
                <View style={styles.profileImageContainer}>
                  <TouchableOpacity onPress={pickImage} disabled={isUploadingImage}>
                    {isUploadingImage ? (
                      <View style={styles.profileImagePlaceholder}>
                        <ActivityIndicator size="large" color="#FFFFFF" />
                      </View>
                    ) : profileImage ? (
                      <Image source={{ uri: profileImage }} style={styles.profileImage} />
                    ) : (
                      <LinearGradient
                        colors={['#9C27B0', '#673AB7']}
                        style={styles.profileImagePlaceholder}
                      >
                        <Text style={styles.profileImagePlaceholderText}>
                          {displayName.charAt(0).toUpperCase()}
                        </Text>
                      </LinearGradient>
                    )}
                    <View style={styles.editIconContainer}>
                      <FontAwesome name="camera" size={18} color="white" />
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.profileName}>{displayName}</Text>
                  {memberSince && (
                    <Text style={styles.memberSince}>Connected since {memberSince}</Text>
                  )}
                </View>
              </View>
              
              <View style={styles.contentContainer}>
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <FontAwesome name="id-badge" size={18} color="#B39DDB" />
                    <Text style={styles.cardTitle}>Your Ping ID</Text>
                  </View>
                  <View style={styles.cardContent}>
                    <View style={styles.pingIdContainer}>
                      <Text style={styles.pingId}>{pingId}</Text>
                      <TouchableOpacity 
                        style={styles.copyButton} 
                        onPress={copyToClipboard}
                      >
                        <LinearGradient
                          colors={['#9C27B0', '#673AB7']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.gradientButton}
                        >
                          <FontAwesome name="copy" size={16} color="white" />
                          <Text style={styles.copyText}>Copy</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.infoText}>Transmit this ID to connect with others</Text>
                  </View>
                </View>
                
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <FontAwesome name="user" size={18} color="#B39DDB" />
                    <Text style={styles.cardTitle}>Account Data</Text>
                  </View>
                  <View style={styles.cardContent}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Display Name</Text>
                      <TextInput
                        style={styles.input}
                        value={displayName}
                        onChangeText={setDisplayName}
                        placeholder="Your display name"
                        placeholderTextColor="#B39DDB"
                      />
                    </View>
                    
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Email</Text>
                      <TextInput
                        style={[styles.input, styles.disabledInput]}
                        value={email}
                        editable={false}
                      />
                      <Text style={styles.inputHint}>Email is locked to this account</Text>
                    </View>
                    
                    <TouchableOpacity 
                      style={[styles.updateButton, isSaving && styles.disabledButton]} 
                      onPress={handleUpdate}
                      disabled={isSaving}
                    >
                      <LinearGradient
                        colors={['#9C27B0', '#673AB7']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.gradientButton}
                      >
                        {isSaving ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <>
                            <FontAwesome name="check" size={16} color="white" style={styles.buttonIcon} />
                            <Text style={styles.buttonText}>Save Changes</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={styles.logoutButton} 
                  onPress={handleLogout}
                >
                  <FontAwesome name="sign-out" size={18} color="#FF4081" style={styles.buttonIcon} />
                  <Text style={styles.logoutButtonText}>Disconnect</Text>
                </TouchableOpacity>
                
                <Text style={styles.versionText}>Galaxy Ping v1.0.0</Text>
              </View>

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
            </ScrollView>
          </KeyboardAvoidingView>
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
  safeArea: {
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
    color: '#D1C4E9',
    fontSize: 16,
    marginTop: 10,
    fontFamily: 'monospace',
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(179, 157, 219, 0.3)',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#D1C4E9',
    fontFamily: 'monospace',
  },
  profileImageSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  profileImageContainer: {
    alignItems: 'center',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#B39DDB',
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#B39DDB',
  },
  profileImagePlaceholderText: {
    color: 'white',
    fontSize: 48,
    fontWeight: 'bold',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: '#9C27B0',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#B39DDB',
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#D1C4E9',
    marginTop: 10,
    fontFamily: 'monospace',
  },
  memberSince: {
    fontSize: 14,
    color: '#B39DDB',
    marginTop: 3,
    fontFamily: 'monospace',
  },
  contentContainer: {
    padding: 20,
    paddingTop: 10,
  },
  card: {
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
    borderRadius: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(179, 157, 219, 0.3)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(179, 157, 219, 0.3)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D1C4E9',
    marginLeft: 10,
    fontFamily: 'monospace',
  },
  cardContent: {
    padding: 15,
  },
  pingIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  pingId: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  copyButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  gradientButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  copyText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 5,
    fontFamily: 'monospace',
  },
  infoText: {
    fontSize: 13,
    color: '#B39DDB',
    marginTop: 5,
    fontFamily: 'monospace',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D1C4E9',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(179, 157, 219, 0.3)',
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  disabledInput: {
    backgroundColor: 'rgba(179, 157, 219, 0.1)',
    color: '#B39DDB',
  },
  inputHint: {
    fontSize: 12,
    color: '#B39DDB',
    marginTop: 5,
    fontFamily: 'monospace',
  },
  updateButton: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 10,
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    fontFamily: 'monospace',
  },
  logoutButton: {
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FF4081',
    padding: 15,
    alignItems: 'center',
    marginBottom: 30,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: '#FF4081',
    fontWeight: 'bold',
    fontSize: 16,
    fontFamily: 'monospace',
  },
  versionText: {
    textAlign: 'center',
    color: '#B39DDB',
    fontSize: 12,
    marginBottom: 30,
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
});