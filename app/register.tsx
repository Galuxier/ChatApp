import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Animated,
  Image, // เพิ่ม Image เข้ามา
} from 'react-native';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pingId, setPingId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const fadeAnim = useState(new Animated.Value(0))[0];
  const translateY = useState(new Animated.Value(50))[0];
  const stars = [...Array(20)].map(() => ({
    top: Math.random() * height,
    left: Math.random() * width,
    size: Math.random() * 3 + 1,
    opacity: new Animated.Value(Math.random() * 0.5 + 0.1),
    duration: Math.random() * 2000 + 1000,
  }));
  
  const meteorPosition = useState(new Animated.ValueXY({ x: -100, y: Math.random() * height / 2 }))[0];
  const meteorOpacity = useState(new Animated.Value(0))[0];
  
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();
    
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
    
    const animateMeteor = () => {
      meteorPosition.setValue({ x: -100, y: Math.random() * height / 3 });
      
      Animated.parallel([
        Animated.timing(meteorPosition, {
          toValue: { x: width + 100, y: height / 2 + Math.random() * height / 3 },
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(meteorOpacity, {
            toValue: 0.7,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(meteorOpacity, {
            toValue: 0,
            duration: 1700,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        setTimeout(animateMeteor, Math.random() * 10000 + 3000);
      });
    };
    
    setTimeout(animateMeteor, 2000);
  }, [fadeAnim, translateY, meteorPosition, meteorOpacity, stars]);

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
    setError('');
    
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
      const pingIdCheckResult = await checkPingIdAvailability(pingId);
      if (!pingIdCheckResult.available) {
        setError('This Ping ID is already taken. Please choose another one.');
        setIsLoading(false);
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName });
      
      await setDoc(doc(db, 'users', user.uid), {
        displayName,
        email,
        pingId,
        createdAt: new Date(),
      });
      
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(
        errorMessage.includes('email-already-in-use')
          ? 'This email is already registered'
          : 'Registration failed. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ImageBackground 
      source={{ uri: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=1000' }} 
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(45, 13, 83, 0.7)', 'rgba(76, 41, 122, 0.85)', 'rgba(30, 7, 55, 0.95)']}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={{
              width: '100%',
              opacity: fadeAnim,
              transform: [{ translateY }],
            }}>
              <View style={styles.headerContainer}>
                {/* แทนที่ข้อความด้วยโลโก้ */}
                <Image 
                  source={require('../assets/logo.png')} 
                  style={styles.logo}
                  resizeMode="contain"
                />
                <Text style={styles.subtitle}>Join the cosmos of connections</Text>
              </View>
              
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              
              <View style={styles.formContainer}>
                <View style={styles.inputContainer}>
                  <FontAwesome name="user" size={20} color="#B39DDB" style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="Display Name" 
                    placeholderTextColor="#9E9E9E"
                    value={displayName} 
                    onChangeText={setDisplayName} 
                    editable={!isLoading}
                  />
                </View>
                
                <View style={styles.inputContainer}>
                  <FontAwesome name="id-badge" size={20} color="#B39DDB" style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="Ping ID (unique username)" 
                    placeholderTextColor="#9E9E9E"
                    value={pingId} 
                    onChangeText={setPingId}
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                </View>
                
                <View style={styles.inputContainer}>
                  <FontAwesome name="envelope" size={20} color="#B39DDB" style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="Email" 
                    placeholderTextColor="#9E9E9E"
                    value={email} 
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                </View>
                
                <View style={styles.inputContainer}>
                  <FontAwesome name="lock" size={20} color="#B39DDB" style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="Password" 
                    placeholderTextColor="#9E9E9E"
                    value={password} 
                    onChangeText={setPassword} 
                    secureTextEntry 
                    editable={!isLoading}
                  />
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.registerButton} 
                onPress={handleRegister}
                disabled={isLoading}
              >
                <LinearGradient
                  colors={['#9C27B0', '#673AB7']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <Text style={styles.buttonText}>Create Account</Text>
                      <FontAwesome name="arrow-right" size={16} color="white" style={styles.buttonIcon} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              
              <View style={styles.loginContainer}>
                <Text style={styles.loginText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/login')} disabled={isLoading}>
                  <Text style={styles.loginLink}>Sign in</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
            
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
              
              <Animated.View
                style={[
                  styles.meteor,
                  {
                    opacity: meteorOpacity,
                    transform: [
                      { translateX: meteorPosition.x },
                      { translateY: meteorPosition.y },
                      { rotate: '20deg' }
                    ],
                  },
                ]}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 150, // ปรับขนาดตามความเหมาะสม
    height: 150, // ปรับขนาดตามความเหมาะสม
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#D1C4E9',
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    marginBottom: 25,
  },
  errorText: {
    color: '#FF6E6E',
    marginBottom: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 5,
    width: '100%',
  },
  inputContainer: {
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
    borderRadius: 10,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(179, 157, 219, 0.3)',
  },
  inputIcon: {
    padding: 15,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    paddingVertical: 15,
    paddingRight: 15,
    fontSize: 16,
  },
  registerButton: {
    width: '100%',
    marginBottom: 20,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#9C27B0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
    marginRight: 10,
  },
  buttonIcon: {
    marginLeft: 10,
  },
  loginContainer: {
    flexDirection: 'row',
    marginTop: 15,
  },
  loginText: {
    color: '#D1C4E9',
  },
  loginLink: {
    color: '#B39DDB',
    fontWeight: 'bold',
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
  meteor: {
    position: 'absolute',
    width: 120,
    height: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  }
});