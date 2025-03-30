import React, { useState, useEffect } from 'react';
import { 
  View, 
  TextInput, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  TouchableWithoutFeedback,
  Keyboard,
  StatusBar,
  Animated,
  ImageBackground,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { router } from 'expo-router';
import { useAuth } from '../context/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [secureTextEntry, setSecureTextEntry] = useState(true);

  // Animation for stars
  const stars = [...Array(20)].map(() => ({
    top: Math.random() * height,
    left: Math.random() * width,
    size: Math.random() * 3 + 1,
    opacity: new Animated.Value(Math.random() * 0.5 + 0.1),
    duration: Math.random() * 2000 + 1000,
  }));

  useEffect(() => {
    if (user) {
      router.replace('/(tabs)/home');
    }

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
  }, [user, stars]);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
  
    setIsLoading(true);
    setError('');
  
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setIsLoading(false);
      router.replace('/(tabs)/home');
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(
        errorMessage.includes('user-not-found') || errorMessage.includes('wrong-password')
          ? 'Invalid email or password'
          : 'Login failed. Please try again.'
      );
      setIsLoading(false);
    }
  };

  const toggleSecureEntry = () => {
    setSecureTextEntry(!secureTextEntry);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
            <StatusBar barStyle="light-content" />
            
            <View style={styles.logoContainer}>
              <Image 
                source={require('../assets/logo.png')} 
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.subtitle}>Connect with friends instantly</Text>
            </View>
            
            <View style={styles.formContainer}>
              {error ? (
                <View style={styles.errorContainer}>
                  <FontAwesome name="exclamation-circle" size={16} color="#FF6E6E" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <FontAwesome name="envelope" size={18} color="#B39DDB" style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="Email" 
                    value={email} 
                    onChangeText={(text) => {
                      setEmail(text);
                      setError('');
                    }} 
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!isLoading}
                    placeholderTextColor="#9E9E9E"
                  />
                </View>
                
                <View style={styles.inputWrapper}>
                  <FontAwesome name="lock" size={20} color="#B39DDB" style={styles.inputIcon} />
                  <TextInput 
                    style={styles.input} 
                    placeholder="Password" 
                    value={password} 
                    onChangeText={(text) => {
                      setPassword(text);
                      setError('');
                    }} 
                    secureTextEntry={secureTextEntry} 
                    editable={!isLoading}
                    placeholderTextColor="#9E9E9E"
                  />
                  <TouchableOpacity onPress={toggleSecureEntry} style={styles.secureTextButton}>
                    <FontAwesome 
                      name={secureTextEntry ? "eye" : "eye-slash"} 
                      size={20} 
                      color="#B39DDB" 
                    />
                  </TouchableOpacity>
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.loginButton} 
                onPress={handleLogin}
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
                      <Text style={styles.buttonText}>Login</Text>
                      <FontAwesome name="arrow-right" size={16} color="white" style={styles.buttonIcon} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              
              <View style={styles.registerContainer}>
                <Text style={styles.registerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/register')} disabled={isLoading}>
                  <Text style={styles.registerLink}>Sign up</Text>
                </TouchableOpacity>
              </View>
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
          </KeyboardAvoidingView>
        </LinearGradient>
      </ImageBackground>
    </TouchableWithoutFeedback>
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
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#D1C4E9',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
    borderRadius: 15,
    marginHorizontal: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(179, 157, 219, 0.3)',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 110, 110, 0.2)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 110, 110, 0.3)',
  },
  errorText: {
    color: '#FF6E6E',
    marginLeft: 10,
    fontSize: 14,
    flex: 1,
  },
  inputContainer: {
    marginBottom: 25,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(179, 157, 219, 0.3)',
  },
  inputIcon: {
    padding: 15,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#FFFFFF',
  },
  secureTextButton: {
    padding: 15,
  },
  loginButton: {
    width: '100%',
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
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 15,
  },
  registerText: {
    color: '#D1C4E9',
    fontSize: 15,
  },
  registerLink: {
    color: '#B39DDB',
    fontWeight: 'bold',
    fontSize: 15,
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