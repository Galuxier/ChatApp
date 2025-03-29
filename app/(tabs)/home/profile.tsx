import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router'; // ใช้รับ userId จาก params
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  doc, 
  getDoc, 
  where,
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../context/auth';

interface Post {
  id: string;
  userId: string;
  text: string;
  timestamp: Date;
  likes: { userId: string; timestamp: Date }[];
  likeCount: number;
  commentCount: number;
}

export default function ProfileScreen() {
  const { userId } = useLocalSearchParams(); // ดึง userId จาก URL params
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ displayName: string; profileImage: string | null } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch profile and posts
  useEffect(() => {
    const fetchProfileAndPosts = async () => {
      if (!userId) return;

      try {
        setLoading(true);

        // Fetch user profile
        const userDoc = await getDoc(doc(db, 'users', userId as string));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setProfile({
            displayName: data.displayName || 'Anonymous',
            profileImage: data.profileImage || null,
          });
        }

        // Fetch user's posts
        const postsQuery = query(
          collection(db, 'posts'),
          where('userId', '==', userId),
          orderBy('timestamp', 'desc')
        );
        const postsSnapshot = await getDocs(postsQuery);
        const postsData: Post[] = [];

        for (const postDoc of postsSnapshot.docs) {
          const postData = postDoc.data();
          const commentsQuery = query(
            collection(db, 'posts', postDoc.id, 'comments'),
            orderBy('timestamp', 'desc')
          );
          const commentsSnapshot = await getDocs(commentsQuery);

          postsData.push({
            id: postDoc.id,
            userId: postData.userId,
            text: postData.text,
            timestamp: postData.timestamp?.toDate() || new Date(),
            likes: postData.likes || [],
            likeCount: postData.likes?.length || 0,
            commentCount: commentsSnapshot.size,
          });
        }

        setPosts(postsData);
      } catch (error) {
        console.error('Error fetching profile or posts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndPosts();
  }, [userId]);

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.profileHeader}>
            {profile?.profileImage ? (
              <Image source={{ uri: profile.profileImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.profileImage}>
                <Text style={styles.avatarText}>
                  {profile?.displayName?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            )}
            <Text style={styles.profileName}>{profile?.displayName}</Text>
            <Text style={styles.postCount}>{posts.length} Posts</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.postCard}>
            <Text style={styles.postText}>{item.text}</Text>
            <View style={styles.postStats}>
              {item.likeCount > 0 && (
                <Text style={styles.statText}>
                  <FontAwesome name="thumbs-up" size={12} color="#3498db" /> {item.likeCount}
                </Text>
              )}
              {item.commentCount > 0 && (
                <Text style={styles.statText}>
                  {item.commentCount} {item.commentCount === 1 ? 'comment' : 'comments'}
                </Text>
              )}
            </View>
            <Text style={styles.postTime}>{formatTime(item.timestamp)}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No posts yet.</Text>
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
  profileHeader: {
    backgroundColor: 'white',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarText: {
    color: 'white',
    fontSize: 40,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  postCount: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  postCard: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  postText: {
    fontSize: 16,
    color: '#2c3e50',
    marginBottom: 10,
    lineHeight: 22,
  },
  postStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  statText: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  postTime: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7f8c8d',
  },
});