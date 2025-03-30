import React, { useState, useEffect } from 'react';
import { 
  View, 
  TextInput, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Keyboard,
  SafeAreaView,
  ImageBackground,
  Animated,
  Dimensions,
} from 'react-native';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { router } from 'expo-router';
import { useAuth } from '../context/auth';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function AddFriendScreen() {
  const { user } = useAuth();
  const [pingId, setPingId] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isAdding, setIsAdding] = useState<boolean>(false);

  // Animation states for radar
  const [radarAngle] = useState(new Animated.Value(0));
  const [stars] = useState(
    [...Array(20)].map(() => ({
      top: Math.random() * height,
      left: Math.random() * width,
      size: Math.random() * 3 + 1,
      opacity: new Animated.Value(Math.random() * 0.5 + 0.1),
      duration: Math.random() * 2000 + 1000,
    }))
  );

  useEffect(() => {
    // Radar sweep animation
    const radarAnimation = Animated.loop(
      Animated.timing(radarAngle, {
        toValue: 360,
        duration: 3000,
        useNativeDriver: true,
      })
    );
    radarAnimation.start();

    // Stars twinkling animation
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

    return () => radarAnimation.stop();
  }, [radarAngle, stars]);

  const searchUser = async () => {
    if (pingId.trim() === '') {
      Alert.alert('Error', 'Please enter a Ping ID');
      return;
    }

    setIsSearching(true);
    setSearchResult(null);
    Keyboard.dismiss();

    try {
      const q = query(
        collection(db, 'users'),
        where('pingId', '==', pingId.trim())
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setSearchResult({ found: false });
      } else {
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        
        if (userDoc.id === user?.uid) {
          Alert.alert('Error', 'You cannot add yourself as a contact');
          setIsSearching(false);
          return;
        }
        
        setSearchResult({
          found: true,
          userId: userDoc.id,
          displayName: userData.displayName,
          pingId: userData.pingId
        });
      }
    } catch (error) {
      console.error('Error searching for user:', error);
      Alert.alert('Error', 'Failed to scan for contact. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const addFriend = async () => {
    if (!searchResult || !searchResult.found || !user) return;
    
    setIsAdding(true);
    
    try {
      const currentUserId = user.uid;
      const friendId = searchResult.userId;
      const chatId = [currentUserId, friendId].sort().join('_');
      
      await Promise.all([
        setDoc(doc(db, 'userChats', `${currentUserId}_${chatId}`), {
          userId: currentUserId,
          chatId: chatId,
          friendId: friendId,
          createdAt: new Date()
        }),
        setDoc(doc(db, 'userChats', `${friendId}_${chatId}`), {
          userId: friendId,
          chatId: chatId,
          friendId: currentUserId,
          createdAt: new Date()
        }),
        setDoc(doc(db, 'chats', chatId), {
          participants: [currentUserId, friendId],
          createdAt: new Date(),
          updatedAt: new Date()
        })
      ]);

      Alert.alert(
        'Contact Established', 
        `${searchResult.displayName} added successfully!`,
        [
          { 
            text: 'Initiate Transmission', 
            onPress: () => router.push(`/chat/${friendId}`)
          },
          {
            text: 'Return to Contacts',
            onPress: () => router.push('/(tabs)/chats')
          }
        ]
      );
    } catch (error) {
      console.error('Error adding friend:', error);
      Alert.alert('Error', 'Failed to establish contact. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <ImageBackground 
      source={{ uri: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=1000' }} 
      style={styles.backgroundImage}
    >
      <LinearGradient
        colors={['rgba(45, 13, 83, 0.7)', 'rgba(76, 41, 122, 0.85)', 'rgba(30, 7, 55, 0.95)']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.container}>
          {/* Custom Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <FontAwesome name="arrow-left" size={20} color="#B39DDB" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Scan for Contact</Text>
            <View style={styles.headerRight} />
          </View>
          
          <View style={styles.content}>
            <Text style={styles.subtitle}>Enter Ping ID to scan the galaxy</Text>
            
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter Ping ID"
                placeholderTextColor="#B39DDB"
                value={pingId}
                onChangeText={setPingId}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity 
                style={styles.searchButton} 
                onPress={searchUser}
                disabled={isSearching}
              >
                <LinearGradient
                  colors={['#9C27B0', '#673AB7']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}
                >
                  {isSearching ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.searchButtonText}>Scan</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
            
            {isSearching && (
              <View style={styles.radarContainer}>
                <Animated.View
                  style={[
                    styles.radarSweep,
                    {
                      transform: [
                        { rotate: radarAngle.interpolate({
                            inputRange: [0, 360],
                            outputRange: ['0deg', '360deg']
                          })
                        }
                      ]
                    }
                  ]}
                />
                <Text style={styles.radarText}>Scanning galaxy...</Text>
              </View>
            )}

            {searchResult && !isSearching && (
              <View style={styles.resultContainer}>
                {searchResult.found ? (
                  <>
                    <View style={styles.userFound}>
                      <LinearGradient
                        colors={['#9C27B0', '#673AB7']}
                        style={styles.avatar}
                      >
                        <Text style={styles.avatarText}>
                          {searchResult.displayName.charAt(0).toUpperCase()}
                        </Text>
                      </LinearGradient>
                      <View style={styles.userInfo}>
                        <Text style={styles.displayName}>{searchResult.displayName}</Text>
                        <Text style={styles.pingIdText}>Ping ID: {searchResult.pingId}</Text>
                      </View>
                    </View>
                    
                    <TouchableOpacity 
                      style={styles.addButton}
                      onPress={addFriend}
                      disabled={isAdding}
                    >
                      <LinearGradient
                        colors={['#9C27B0', '#673AB7']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.gradientButton}
                      >
                        {isAdding ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <Text style={styles.addButtonText}>Establish Contact</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.notFound}>
                    <Text style={styles.notFoundText}>No signal detected</Text>
                    <Text style={styles.notFoundSubtext}>Check the Ping ID and scan again</Text>
                  </View>
                )}
              </View>
            )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(179, 157, 219, 0.3)',
  },
  backButton: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D1C4E9',
    fontFamily: 'monospace',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    color: '#B39DDB',
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 5,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(179, 157, 219, 0.3)',
    marginRight: 10,
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  searchButton: {
    borderRadius: 5,
    overflow: 'hidden',
  },
  gradientButton: {
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  searchButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    fontFamily: 'monospace',
  },
  radarContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  radarSweep: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#B39DDB',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    opacity: 0.7,
  },
  radarText: {
    marginTop: 10,
    color: '#B39DDB',
    fontSize: 16,
    fontFamily: 'monospace',
  },
  resultContainer: {
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(179, 157, 219, 0.3)',
  },
  userFound: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    borderWidth: 2,
    borderColor: '#B39DDB',
  },
  avatarText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D1C4E9',
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  pingIdText: {
    fontSize: 14,
    color: '#B39DDB',
    fontFamily: 'monospace',
  },
  addButton: {
    borderRadius: 5,
    overflow: 'hidden',
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    fontFamily: 'monospace',
  },
  notFound: {
    alignItems: 'center',
    padding: 20,
  },
  notFoundText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF4081',
    marginBottom: 10,
    fontFamily: 'monospace',
  },
  notFoundSubtext: {
    fontSize: 14,
    color: '#B39DDB',
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