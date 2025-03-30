import React, { useState, useEffect, useRef } from 'react';
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
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  Animated,
  Dimensions,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  where,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../context/auth';
import { PostCard } from '../../../components/PostCard';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface Comment {
  id: string;
  userId: string;
  userName: string;
  userImage: string | null;
  text: string;
  timestamp: Date;
}

interface PostLike {
  userId: string;
  timestamp: Date;
}

interface Post {
  id: string;
  userId: string;
  userName: string;
  userImage: string | null;
  text: string;
  timestamp: Date;
  likes: PostLike[];
  likeCount: number;
  commentCount: number;
  isLikedByMe?: boolean;
  comments?: Comment[];
}

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [posting, setPosting] = useState(false);
  const [userData, setUserData] = useState<{
    displayName: string;
    profileImage: string | null;
  } | null>(null);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const commentInputRef = useRef<TextInput>(null);

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
      if (!user) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData({
            displayName: data.displayName || 'Anonymous',
            profileImage: data.profileImage || null,
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, [user]);

  useEffect(() => {
    const fetchFriendIds = async () => {
      if (!user) return;

      try {
        const userChatsQuery = query(
          collection(db, 'userChats'),
          where('userId', '==', user.uid)
        );
        const userChatsSnapshot = await getDocs(userChatsQuery);
        const friendIdsList = userChatsSnapshot.docs.map(doc => doc.data().friendId);
        setFriendIds([...friendIdsList, user.uid]);
      } catch (error) {
        console.error('Error fetching friend IDs:', error);
      }
    };

    fetchFriendIds();
  }, [user]);

  useEffect(() => {
    if (friendIds.length > 0) fetchPosts();

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
  }, [friendIds]);

  const fetchPosts = async () => {
    if (!user || friendIds.length === 0) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      const postsQuery = query(
        collection(db, 'posts'),
        where('userId', 'in', friendIds),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
      const postsSnapshot = await getDocs(postsQuery);
      const postsData: Post[] = [];

      for (const postDoc of postsSnapshot.docs) {
        const postData = postDoc.data();
        const userDoc = await getDoc(doc(db, 'users', postData.userId));
        const userData = userDoc.exists() ? userDoc.data() : { displayName: 'Unknown User' };
        const commentsQuery = query(
          collection(db, 'posts', postDoc.id, 'comments'),
          orderBy('timestamp', 'desc')
        );
        const commentsSnapshot = await getDocs(commentsQuery);
        const likesArray = postData.likes || [];
        const isLikedByMe = likesArray.some((like: any) => like.userId === user.uid);

        postsData.push({
          id: postDoc.id,
          userId: postData.userId,
          userName: userData.displayName || 'Unknown User',
          userImage: userData.profileImage || null,
          text: postData.text,
          timestamp: postData.timestamp?.toDate() || new Date(),
          likes: postData.likes || [],
          likeCount: postData.likes?.length || 0,
          commentCount: commentsSnapshot.size,
          isLikedByMe,
        });
      }

      setPosts(postsData);
    } catch (error) {
      console.error('Error fetching posts:', error);
      Alert.alert('Error', 'Could not load posts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const openCommentsParam = params.openComments;
    const postId = params.postId;

    if (openCommentsParam === 'true' && postId && posts.length > 0) {
      const post = posts.find(p => p.id === postId as string);
      if (post) {
        openCommentModal(post);
      }
    }
  }, [posts, params]);

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
        likes: [],
        likeCount: 0,
        createdAt: new Date(),
      });
      setNewPostText('');
      fetchPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Could not create post.');
    } finally {
      setPosting(false);
    }
  };

  const handleLikePost = async (postId: string) => {
    if (!user) return;

    try {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      if (!postDoc.exists()) return;

      const postData = postDoc.data();
      const likes = postData.likes || [];
      const isLiked = likes.some((like: any) => like.userId === user.uid);

      if (isLiked) {
        await updateDoc(postRef, { likes: likes.filter((like: any) => like.userId !== user.uid) });
        setPosts(posts.map(post =>
          post.id === postId
            ? { ...post, likes: post.likes.filter(like => like.userId !== user.uid), likeCount: post.likeCount - 1, isLikedByMe: false }
            : post
        ));
      } else {
        const newLike = { userId: user.uid, timestamp: new Date() };
        await updateDoc(postRef, { likes: [...likes, newLike] });
        setPosts(posts.map(post =>
          post.id === postId
            ? { ...post, likes: [...post.likes, newLike], likeCount: post.likeCount + 1, isLikedByMe: true }
            : post
        ));
      }
    } catch (error) {
      console.error('Error updating like:', error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!user) return;

    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'posts', postId));
            setPosts(posts.filter(post => post.id !== postId));
          } catch (error) {
            console.error('Error deleting post:', error);
            Alert.alert('Error', 'Could not delete post.');
          }
        },
      },
    ]);
  };

  const openCommentModal = async (post: Post) => {
    setSelectedPost(post);
    setCommentModalVisible(true);
    setLoadingComments(true);

    try {
      const commentsQuery = query(
        collection(db, 'posts', post.id, 'comments'),
        orderBy('timestamp', 'desc')
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      const commentsData: Comment[] = [];

      for (const commentDoc of commentsSnapshot.docs) {
        const commentData = commentDoc.data();
        const userDoc = await getDoc(doc(db, 'users', commentData.userId));
        const userData = userDoc.exists() ? userDoc.data() : { displayName: 'Unknown User' };

        commentsData.push({
          id: commentDoc.id,
          userId: commentData.userId,
          userName: userData.displayName || 'Unknown User',
          userImage: userData.profileImage || null,
          text: commentData.text,
          timestamp: commentData.timestamp?.toDate() || new Date(),
        });
      }

      setSelectedPost({ ...post, comments: commentsData, commentCount: commentsSnapshot.size });
      setPosts(posts.map(p => 
        p.id === post.id ? { ...p, commentCount: commentsSnapshot.size } : p
      ));
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const addComment = async () => {
    if (!user || !selectedPost || !newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const newCommentData = {
        userId: user.uid,
        text: newComment.trim(),
        timestamp: new Date(),
      };

      const commentRef = await addDoc(collection(db, 'posts', selectedPost.id, 'comments'), newCommentData);

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : { displayName: 'Unknown User' };

      const newCommentObj: Comment = {
        id: commentRef.id,
        userId: user.uid,
        userName: userData.displayName || 'Unknown User',
        userImage: userData.profileImage || null,
        text: newCommentData.text,
        timestamp: newCommentData.timestamp,
      };

      setSelectedPost({
        ...selectedPost,
        comments: selectedPost.comments ? [newCommentObj, ...selectedPost.comments] : [newCommentObj],
        commentCount: selectedPost.commentCount + 1,
      });

      setPosts(posts.map(post =>
        post.id === selectedPost.id
          ? { ...post, commentCount: post.commentCount + 1 }
          : post
      ));

      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Could not add comment.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleUserPress = (userId: string) => {
    if (commentModalVisible) {
      setCommentModalVisible(false);
      setSelectedPost(null);
      setNewComment('');
    }
    router.push({ pathname: '/(tabs)/home/profile', params: { userId } });
  };

  if (loading && !refreshing) {
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
        <View style={styles.container}>
          <View style={styles.header}>
            <Image source={require('../../../assets/logo.png')} style={styles.headerLogo} />
          </View>

          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#B39DDB']} />
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
                    placeholderTextColor="#9E9E9E"
                    multiline
                    value={newPostText}
                    onChangeText={setNewPostText}
                    editable={!posting}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.postButton, (!newPostText.trim() || posting) && styles.disabledButton]}
                  onPress={createPost}
                  disabled={!newPostText.trim() || posting}
                >
                  <LinearGradient
                    colors={['#9C27B0', '#673AB7']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    {posting ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.postButtonText}>Post</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            }
            renderItem={({ item }) => (
              <PostCard
                post={item}
                onLike={handleLikePost}
                onComment={openCommentModal}
                onDelete={item.userId === user?.uid ? handleDeletePost : undefined}
                onUserPress={handleUserPress}
                isOwnPost={item.userId === user?.uid}
              />
            )}
            ListEmptyComponent={
              friendIds.length > 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No posts yet.</Text>
                  <Text style={styles.emptySubText}>Be the first to share something!</Text>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Add friends to see their posts</Text>
                  <Text style={styles.emptySubText}>Find friends using the Chat tab</Text>
                </View>
              )
            }
          />

          <Modal
            animationType="slide"
            transparent={false}
            visible={commentModalVisible}
            onRequestClose={() => {
              setCommentModalVisible(false);
              setSelectedPost(null);
              setNewComment('');
            }}
          >
            <ImageBackground 
              source={{ uri: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=1000' }} 
              style={styles.backgroundImage}
            >
              <LinearGradient
                colors={['rgba(45, 13, 83, 0.7)', 'rgba(76, 41, 122, 0.85)', 'rgba(30, 7, 55, 0.95)']}
                style={styles.gradient}
              >
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  style={styles.modalContainer}
                >
                  <View style={styles.modalHeader}>
                    <TouchableOpacity
                      onPress={() => {
                        setCommentModalVisible(false);
                        setSelectedPost(null);
                        setNewComment('');
                      }}
                    >
                      <FontAwesome name="arrow-left" size={20} color="#B39DDB" />
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>Comments</Text>
                    <View style={styles.headerSpacer} />
                  </View>

                  {selectedPost && (
                    <>
                      <View style={styles.modalPostPreview}>
                        <TouchableOpacity onPress={() => handleUserPress(selectedPost.userId)}>
                          <Text style={styles.previewUserName}>{selectedPost.userName}</Text>
                        </TouchableOpacity>
                        <Text style={styles.previewText}>{selectedPost.text}</Text>
                      </View>

                      {loadingComments ? (
                        <View style={styles.loadingCommentsContainer}>
                          <ActivityIndicator size="large" color="#B39DDB" />
                        </View>
                      ) : (
                        <FlatList
                          data={selectedPost.comments}
                          keyExtractor={(item) => item.id}
                          renderItem={({ item }) => (
                            <View style={styles.commentItem}>
                              <TouchableOpacity onPress={() => handleUserPress(item.userId)}>
                                <Text style={styles.commentUserName}>{item.userName}</Text>
                              </TouchableOpacity>
                              <Text style={styles.commentText}>{item.text}</Text>
                            </View>
                          )}
                          ListEmptyComponent={
                            <View style={styles.emptyCommentsContainer}>
                              <Text style={styles.emptyCommentsText}>No comments yet.</Text>
                            </View>
                          }
                        />
                      )}

                      <View style={styles.commentInputContainer}>
                        <TextInput
                          ref={commentInputRef}
                          style={styles.commentInput}
                          placeholder="Write a comment..."
                          placeholderTextColor="#9E9E9E"
                          value={newComment}
                          onChangeText={setNewComment}
                          multiline
                          editable={!submittingComment}
                        />
                        <TouchableOpacity
                          style={[
                            styles.commentButton,
                            (!newComment.trim() || submittingComment) && styles.disabledButton,
                          ]}
                          onPress={addComment}
                          disabled={!newComment.trim() || submittingComment}
                        >
                          <LinearGradient
                            colors={['#9C27B0', '#673AB7']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.gradientButton}
                          >
                            {submittingComment ? (
                              <ActivityIndicator size="small" color="white" />
                            ) : (
                              <FontAwesome name="send" size={18} color="white" />
                            )}
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </KeyboardAvoidingView>
              </LinearGradient>
            </ImageBackground>
          </Modal>

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
        </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 15,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  headerLogo: {
    width: 100,
    height: 100,
  },
  createPostContainer: {
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
    padding: 15,
    margin: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(179, 157, 219, 0.3)',
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
    backgroundColor: '#B39DDB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  postInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    color: '#FFFFFF',
  },
  postButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  disabledButton: {
    opacity: 0.6,
  },
  gradientButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  postButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
    margin: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(179, 157, 219, 0.3)',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D1C4E9',
    marginBottom: 5,
  },
  emptySubText: {
    fontSize: 14,
    color: '#B39DDB',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(179, 157, 219, 0.3)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 30,
  },
  modalPostPreview: {
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(179, 157, 219, 0.3)',
  },
  previewUserName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D1C4E9',
  },
  previewText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 5,
  },
  loadingCommentsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentItem: {
    padding: 10,
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
    marginVertical: 5,
    marginHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(179, 157, 219, 0.3)',
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D1C4E9',
  },
  commentText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 5,
  },
  emptyCommentsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyCommentsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D1C4E9',
  },
  commentInputContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(179, 157, 219, 0.3)',
  },
  commentInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    color: '#FFFFFF',
  },
  commentButton: {
    marginLeft: 10,
    borderRadius: 20,
    overflow: 'hidden',
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