import React, { useState, useEffect, useRef } from 'react';
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
  Easing,
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

  // Animation states
  const [radarAngle] = useState(new Animated.Value(0));
  const [radarScale] = useState(new Animated.Value(0.8));
  const [radarOpacity] = useState(new Animated.Value(0.7));
  const [scanLineAngle] = useState(new Animated.Value(0));
  const [blipOpacity] = useState(new Animated.Value(0));
  const [blipPosition] = useState(new Animated.ValueXY({ x: 0, y: 0 }));
  const [blipScale] = useState(new Animated.Value(0));
  const [scanningTextOpacity] = useState(new Animated.Value(0));
  const [scanLinePulse] = useState(new Animated.Value(0));
  
  const stars = useRef([...Array(20)].map(() => ({
    top: Math.random() * height,
    left: Math.random() * width,
    size: Math.random() * 3 + 1,
    opacity: new Animated.Value(Math.random() * 0.5 + 0.1),
    duration: Math.random() * 2000 + 1000,
  }))).current;

  // Sound blips for radar effect
  const [soundBlips] = useState([...Array(6)].map(() => ({
    position: new Animated.Value(0),
    opacity: new Animated.Value(0),
    scale: new Animated.Value(0.5),
  })));

  // Space ships flying in background
  const spaceshipPosition = useRef(new Animated.ValueXY({ x: -100, y: Math.random() * height / 2 })).current;
  const spaceshipOpacity = useRef(new Animated.Value(0)).current;

  // Random coordinate generator for blips
  const getRandomCoordinate = () => {
    // Generate coordinate within radar circle
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 100; // Radius of radar
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance
    };
  };

  useEffect(() => {
    // Start radar sweep animation
    const radarSweepAnimation = Animated.loop(
      Animated.timing(radarAngle, {
        toValue: 1, // แทนที่จะไปที่ 360 ให้ใช้ 1 แล้ว interpolate
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
  
    // Start scan line rotation
    const scanLineAnimation = Animated.loop(
      Animated.timing(scanLineAngle, {
        toValue: 1, // ใช้ค่า 1 แล้ว interpolate เป็นองศา
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
  
    // Pulse animation for scan line
    const scanLinePulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLinePulse, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLinePulse, {
          toValue: 0.4,
          duration: 1000,
          useNativeDriver: true,
        })
      ])
    );
  
    // Start all animations
    radarSweepAnimation.start();
    scanLineAnimation.start();
    scanLinePulseAnimation.start();
  
    return () => {
      radarSweepAnimation.stop();
      scanLineAnimation.stop();
      scanLinePulseAnimation.stop();
    };
  }, []);

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

  const searchUser = async () => {
    if (pingId.trim() === '') {
      Alert.alert('Error', 'Please enter a Ping ID');
      return;
    }

    setIsSearching(true);
    setSearchResult(null);
    Keyboard.dismiss();
    
    // Start animated scanning text
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanningTextOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(scanningTextOpacity, {
          toValue: 0.3,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    try {
      const q = query(
        collection(db, 'users'),
        where('pingId', '==', pingId.trim())
      );
      
      // Artificial delay for better UX with the radar animation
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setSearchResult({ found: false });
        // No blip effect for not found
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
        
        // Animate a "found" blip on the radar
        blipPosition.setValue(getRandomCoordinate());
        
        Animated.sequence([
          Animated.parallel([
            Animated.timing(blipOpacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(blipScale, {
              toValue: 1.2,
              duration: 300,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(blipScale, {
              toValue: 0.8, 
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.loop(
              Animated.sequence([
                Animated.timing(blipOpacity, {
                  toValue: 1,
                  duration: 800,
                  useNativeDriver: true,
                }),
                Animated.timing(blipOpacity, {
                  toValue: 0.2,
                  duration: 800,
                  useNativeDriver: true,
                }),
              ])
            ),
          ]),
        ]).start();
      }
    } catch (error) {
      console.error('Error searching for user:', error);
      Alert.alert('Error', 'Failed to scan for contact. Please try again.');
    } finally {
      setIsSearching(false);
      scanningTextOpacity.stopAnimation();
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
            <Text style={styles.headerTitle}>INTERGALACTIC SCANNER</Text>
            <View style={styles.headerRight} />
          </View>
          
          <View style={styles.content}>
            <Text style={styles.subtitle}>Enter Ping ID to locate life forms</Text>
            
            <View style={styles.searchContainer}>
              <View style={styles.inputWrapper}>
                <FontAwesome name="search" size={16} color="#B39DDB" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="ENTER PING ID"
                  placeholderTextColor="#B39DDB"
                  value={pingId}
                  onChangeText={setPingId}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {pingId.length > 0 && (
                  <TouchableOpacity onPress={() => setPingId('')} style={styles.clearButton}>
                    <FontAwesome name="times-circle" size={16} color="#B39DDB" />
                  </TouchableOpacity>
                )}
              </View>
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
                    <Text style={styles.searchButtonText}>SCAN</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
            
            {/* Enhanced Radar Display */}
            <View style={styles.radarContainer}>
              <Animated.View 
                style={[
                  styles.radarCircle,
                  {
                    transform: [
                      { scale: radarScale }
                    ],
                    opacity: radarOpacity
                  }
                ]}
              >
                <View style={styles.radarGrid}>
                  <View style={styles.gridLine} />
                  <View style={[styles.gridLine, { transform: [{ rotate: '90deg' }] }]} />
                  <View style={[styles.gridLine, { transform: [{ rotate: '45deg' }] }]} />
                  <View style={[styles.gridLine, { transform: [{ rotate: '135deg' }] }]} />
                </View>
                <View style={styles.radarRings}>
                  <View style={styles.radarRing} />
                  <View style={[styles.radarRing, styles.radarRingMid]} />
                  <View style={[styles.radarRing, styles.radarRingInner]} />
                </View>
                
                {/* Scan line */}
                <Animated.View
                  style={[
                    styles.scanLine,
                    {
                      transform: [
                        { rotate: scanLineAngle.interpolate({
                            inputRange: [0, 360],
                            outputRange: ['0deg', '360deg']
                          })
                        }
                      ],
                      opacity: scanLinePulse
                    }
                  ]}
                />
                
                {/* Blip indicator when found */}
                <Animated.View
                  style={[
                    styles.blip,
                    {
                      transform: [
                        { translateX: blipPosition.x },
                        { translateY: blipPosition.y },
                        { scale: blipScale }
                      ],
                      opacity: blipOpacity
                    }
                  ]}
                />
                
                {/* Sound wave blips */}
                {soundBlips.map((blip, index) => (
                  <Animated.View
                    key={index}
                    style={[
                      styles.soundBlip,
                      {
                        bottom: 10 + index * 10,
                        transform: [
                          { translateY: blip.position.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, -20]
                            })
                          },
                          { scale: blip.scale }
                        ],
                        opacity: blip.opacity
                      }
                    ]}
                  />
                ))}
                
                {isSearching && (
                  <Animated.View 
                    style={[
                      styles.scanningTextContainer,
                      { opacity: scanningTextOpacity }
                    ]}
                  >
                    <Text style={styles.scanningText}>SCANNING</Text>
                    <View style={styles.dotsContainer}>
                      <Text style={styles.dot}>.</Text>
                      <Text style={styles.dot}>.</Text>
                      <Text style={styles.dot}>.</Text>
                    </View>
                  </Animated.View>
                )}
                
                {/* Scanning indicator text */}
                <View style={styles.radarInfoContainer}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>STATUS:</Text>
                    <Text style={styles.infoValue}>
                      {isSearching ? 'SCANNING' : searchResult ? 'COMPLETE' : 'READY'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>RANGE:</Text>
                    <Text style={styles.infoValue}>GALAXY-WIDE</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>SIGNAL:</Text>
                    <Text style={styles.infoValue}>STRONG</Text>
                  </View>
                </View>
                
                {/* Coordinates display */}
                <View style={styles.coordinatesContainer}>
                  <Text style={styles.coordinateText}>LAT: 32.7767°</Text>
                  <Text style={styles.coordinateText}>LONG: -96.7970°</Text>
                </View>
                
                {/* Radar center dot */}
                <View style={styles.radarCenter} />
              </Animated.View>
            </View>

            {searchResult && !isSearching && (
              <View style={styles.resultContainer}>
                {searchResult.found ? (
                  <>
                    <View style={styles.contactFoundBanner}>
                      <FontAwesome name="check-circle" size={18} color="#00FF7F" style={styles.foundIcon} />
                      <Text style={styles.contactFoundText}>CONTACT LOCATED</Text>
                    </View>
                    
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
                        <View style={styles.coordinatesBadge}>
                          <Text style={styles.coordinatesBadgeText}>COORDINATES VERIFIED</Text>
                        </View>
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
                          <>
                            <FontAwesome name="space-shuttle" size={16} color="white" style={styles.buttonIcon} />
                            <Text style={styles.addButtonText}>Establish Contact</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.notFound}>
                    <FontAwesome name="exclamation-triangle" size={32} color="#FF4081" style={styles.warningIcon} />
                    <Text style={styles.notFoundText}>NO SIGNAL DETECTED</Text>
                    <Text style={styles.notFoundSubtext}>Life form does not exist in this galaxy</Text>
                    <TouchableOpacity style={styles.tryAgainButton} onPress={() => setSearchResult(null)}>
                      <Text style={styles.tryAgainText}>Try Different Coordinates</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Flying spaceship */}
          <Animated.View 
            style={[
              styles.spaceship,
              {
                transform: [
                  { translateX: spaceshipPosition.x },
                  { translateY: spaceshipPosition.y },
                  { rotate: '10deg' }
                ],
                opacity: spaceshipOpacity
              }
            ]}
          >
            <FontAwesome name="rocket" size={24} color="#00DDEB" />
            <View style={styles.spaceshipTrail} />
          </Animated.View>

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
    backgroundColor: 'rgba(30, 7, 55, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(179, 157, 219, 0.3)',
  },
  backButton: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00DDEB',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
    color: '#B39DDB',
    fontFamily: 'monospace',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(179, 157, 219, 0.5)',
    paddingHorizontal: 10,
    marginRight: 10,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 45,
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
  clearButton: {
    padding: 8,
  },
  searchButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  gradientButton: {
    height: 45,
    paddingHorizontal: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  radarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  radarCircle: {
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 2,
    borderColor: '#00DDEB',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: 'rgba(0, 221, 235, 0.05)',
  },
  radarGrid: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  gridLine: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(0, 221, 235, 0.2)',
    top: '50%',
    left: 0,
  },
  radarRings: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  radarRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(0, 221, 235, 0.3)',
    top: 25,
    left: 25,
  },
  radarRingMid: {
    width: 150,
    height: 150,
    borderRadius: 75,
    top: 50,
    left: 50,
  },
  radarRingInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    top: 85,
    left: 85,
  },
  scanLine: {
    position: 'absolute',
    width: '50%',
    height: 2,
    backgroundColor: '#00DDEB',
    right: '50%',
    bottom: '50%',
    transform: [{ rotate: '0deg' }],
    transformOrigin: 'right center',
    opacity: 0.7,
    borderRadius: 1,
  },
  blip: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#00FF7F',
    top: 125,
    left: 125,
    marginLeft: -8,
    marginTop: -8,
  },
  soundBlip: {
    position: 'absolute',
    width: 50,
    height: 1,
    backgroundColor: '#00DDEB',
    left: 100,
    opacity: 0.5,
  },
  scanningTextContainer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    top: 110,
  },
  scanningText: {
    color: '#00DDEB',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 20,
    marginLeft: 2,
  },
  dot: {
    color: '#00DDEB',
    fontSize: 24,
    marginLeft: 2,
    fontFamily: 'monospace',
  },
  radarInfoContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  infoLabel: {
    color: 'rgba(0, 221, 235, 0.7)',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginRight: 5,
    letterSpacing: 1,
  },
  infoValue: {
    color: '#00DDEB',
    fontSize: 10,
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  coordinatesContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  coordinateText: {
    color: 'rgba(0, 221, 235, 0.7)',
    fontSize: 10,
    fontFamily: 'monospace',
    textAlign: 'right',
    letterSpacing: 0.5,
  },
  radarCenter: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00DDEB',
    opacity: 0.8,
  },
  resultContainer: {
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(179, 157, 219, 0.3)',
    marginTop: 20,
  },
  contactFoundBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 127, 0.15)',
    borderRadius: 5,
    padding: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 127, 0.3)',
  },
  foundIcon: {
    marginRight: 8,
  },
  contactFoundText: {
    color: '#00FF7F',
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: 1,
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
    marginBottom: 8,
  },
  coordinatesBadge: {
    backgroundColor: 'rgba(0, 221, 235, 0.1)',
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(0, 221, 235, 0.3)',
  },
  coordinatesBadgeText: {
    color: '#00DDEB',
    fontSize: 10,
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  addButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  buttonIcon: {
    marginRight: 8,
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
  warningIcon: {
    marginBottom: 15,
  },
  notFoundText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF4081',
    marginBottom: 10,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  notFoundSubtext: {
    fontSize: 14,
    color: '#B39DDB',
    fontFamily: 'monospace',
    textAlign: 'center',
    marginBottom: 20,
  },
  tryAgainButton: {
    borderWidth: 1,
    borderColor: '#B39DDB',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  tryAgainText: {
    color: '#B39DDB',
    fontFamily: 'monospace',
  },
  spaceship: {
    position: 'absolute',
    zIndex: 2,
  },
  spaceshipTrail: {
    position: 'absolute',
    width: 30,
    height: 2,
    backgroundColor: 'rgba(0, 221, 235, 0.3)',
    right: 20,
    top: 12,
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