import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { collection, query, orderBy, limit, getDocs, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/auth';

interface Post {
  id: string;
  userId: string;
  userName: string;
  userImage: string | null;
  text: string;
  timestamp: Date;
  likes: number;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [posting, setPosting] = useState(false);
  const [userData, setUserData] = useState<{
    displayName: string;
    profileImage: string | null;
  } | null>(null);

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData({
            displayName: data.displayName || 'Anonymous',
            profileImage: data.profileImage || null
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, [user]);

  // Fetch posts
  const fetchPosts = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const postsQuery = query(
        collection(db, 'posts'),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
      
      const postsSnapshot = await getDocs(postsQuery);
      const postsData: Post[] = [];
      
      for (const postDoc of postsSnapshot.docs) {
        const postData = postDoc.data();
        
        // Fetch user info for each post
        const userDoc = await getDoc(doc(db, 'users', postData.userId));
        const userData = userDoc.exists() ? userDoc.data() : { displayName: 'Unknown User' };
        
        postsData.push({
          id: postDoc.id,
          userId: postData.userId,
          userName: userData.displayName || 'Unknown User',
          userImage: userData.profileImage || null,
          text: postData.text,
          timestamp: postData.timestamp?.toDate() || new Date(),
          likes: postData.likes || 0
        });
      }
      
      setPosts(postsData);
    } catch (error) {
      console.error('Error fetching posts:', error);
      Alert.alert('Error', 'Could not load posts. Please try again later.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPosts();
  };

  const createPost = async () => {
    if (!user || !newPostText.trim() || !userData) return;

    setPosting(true);
    
    try {
      await addDoc(collection(db, 'posts'), {
        userId: user.uid,
        text: newPostText.trim(),
        timestamp: new Date(),
        likes: 0,
        createdAt: new Date()
      });
      
      setNewPostText('');
      fetchPosts(); // Refresh posts after creating a new one
      
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Could not create post. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const handleLikePost = async (postId: string) => {
    // In a real app, you would update the like count in Firestore
    // For this example, we'll just update the local state
    setPosts(posts.map(post => 
      post.id === postId 
        ? { ...post, likes: post.likes + 1 } 
        : post
    ));
  };

  // Format timestamp to readable format
  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.round(diffMs / 60000);
    
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    
    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Home</Text>
      </View>
      
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#3498db']}
          />
        }
        ListHeaderComponent={
          <View style={styles.createPostContainer}>
            <View style={styles.userInputRow}>
              {userData?.profileImage ? (
                <Image source={{ uri: userData.profileImage }} style={styles.userAvatar} />
              ) : (
                <View style={styles.userAvatar}>
                  <Text style={styles.avatarText}>
                    {userData?.displayName?.charAt(0).toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
              <TextInput
                style={styles.postInput}
                placeholder="What's on your mind?"
                multiline
                value={newPostText}
                onChangeText={setNewPostText}
                editable={!posting}
              />
            </View>
            
            <TouchableOpacity
              style={[
                styles.postButton,
                (!newPostText.trim() || posting) && styles.disabledButton
              ]}
              onPress={createPost}
              disabled={!newPostText.trim() || posting}
            >
              {posting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.postButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.postCard}>
            <View style={styles.postHeader}>
              {item.userImage ? (
                <Image source={{ uri: item.userImage }} style={styles.postAvatar} />
              ) : (
                <View style={styles.postAvatar}>
                  <Text style={styles.avatarText}>
                    {item.userName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.postHeaderInfo}>
                <Text style={styles.postUserName}>{item.userName}</Text>
                <Text style={styles.postTime}>{formatTime(item.timestamp)}</Text>
              </View>
            </View>
            
            <Text style={styles.postText}>{item.text}</Text>
            
            <View style={styles.postActions}>
              <TouchableOpacity 
                style={styles.likeButton}
                onPress={() => handleLikePost(item.id)}
              >
                <FontAwesome name="thumbs-o-up" size={18} color="#3498db" />
                <Text style={styles.likeButtonText}>
                  {item.likes > 0 ? `Like (${item.likes})` : 'Like'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.commentButton}>
                <FontAwesome name="comment-o" size={18} color="#7f8c8d" />
                <Text style={styles.commentButtonText}>Comment</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No posts yet.</Text>
            <Text style={styles.emptySubText}>Be the first to share something!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  createPostContainer: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  userInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  postInput: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
  },
  postButton: {
    backgroundColor: '#3498db',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#95c8ea',
  },
  postButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  postCard: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  postHeaderInfo: {
    flex: 1,
  },
  postUserName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  postTime: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  postText: {
    fontSize: 16,
    color: '#2c3e50',
    marginBottom: 15,
    lineHeight: 22,
  },
  postActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    paddingVertical: 5,
  },
  likeButtonText: {
    marginLeft: 5,
    color: '#3498db',
    fontSize: 14,
  },
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  commentButtonText: {
    marginLeft: 5,
    color: '#7f8c8d',
    fontSize: 14,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7f8c8d',
    marginBottom: 5,
  },
  emptySubText: {
    fontSize: 14,
    color: '#95a5a6',
  },
});