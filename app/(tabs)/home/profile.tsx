import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  Animated,
  Dimensions,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../context/auth';
import { PostCard } from '../../../components/PostCard';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface PostLike {
  userId: string;
  timestamp: Date;
}

interface Comment {
  id: string;
  userId: string;
  userName: string;
  userImage: string | null;
  text: string;
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

export default function ProfileScreen() {
  const { userId } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<{
    displayName: string;
    profileImage: string | null;
    pingId: string | null;
  } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false);
  const [isCheckingFriendship, setIsCheckingFriendship] = useState(true);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  // Animation for stars
  const stars = [...Array(20)].map(() => ({
    top: Math.random() * height,
    left: Math.random() * width,
    size: Math.random() * 3 + 1,
    opacity: new Animated.Value(Math.random() * 0.5 + 0.1),
    duration: Math.random() * 2000 + 1000,
  }));

  useEffect(() => {
    const checkFriendship = async () => {
      if (!user || !userId) {
        setIsCheckingFriendship(false);
        return;
      }

      try {
        const currentUserId = user.uid;
        const profileUserId = userId as string;

        if (currentUserId === profileUserId) {
          setIsCheckingFriendship(false);
          return;
        }

        const chatId = [currentUserId, profileUserId].sort().join('_');
        const userChatRef = doc(db, 'userChats', `${currentUserId}_${chatId}`);
        const userChatDoc = await getDoc(userChatRef);

        setIsFriend(userChatDoc.exists());
      } catch (error) {
        console.error('Error checking friendship:', error);
      } finally {
        setIsCheckingFriendship(false);
      }
    };

    checkFriendship();
  }, [user, userId]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', userId as string));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setProfile({
            displayName: data.displayName || 'Anonymous',
            profileImage: data.profileImage || null,
            pingId: data.pingId || null,
          });
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };

    fetchProfile();
  }, [userId]);

  useEffect(() => {
    const fetchPosts = async () => {
      if (!userId || !profile) return;

      try {
        setLoading(true);
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

          const likesArray = postData.likes || [];
          const isLikedByMe = user ? likesArray.some((like: any) => like.userId === user.uid) : false;

          postsData.push({
            id: postDoc.id,
            userId: postData.userId,
            userName: profile.displayName,
            userImage: profile.profileImage,
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
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();

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
  }, [userId, user, profile]);

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
        await updateDoc(postRef, {
          likes: likes.filter((like: any) => like.userId !== user.uid),
        });
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

  const openComments = async (post: Post) => {
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
      const userData = userDoc.exists() ? userDoc.data() : { displayName: 'Anonymous' };

      const newCommentObj: Comment = {
        id: commentRef.id,
        userId: user.uid,
        userName: userData.displayName || 'Anonymous',
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

  const navigateToChat = () => {
    if (!userId) return;
    router.push(`/chat/${userId}`);
  };

  const addFriend = async () => {
    if (!user || !userId || !profile) return;

    setIsAddingFriend(true);

    try {
      const currentUserId = user.uid;
      const friendId = userId as string;
      const chatId = [currentUserId, friendId].sort().join('_');

      await Promise.all([
        setDoc(doc(db, 'userChats', `${currentUserId}_${chatId}`), {
          userId: currentUserId,
          chatId,
          friendId,
          createdAt: new Date(),
        }),
        setDoc(doc(db, 'userChats', `${friendId}_${chatId}`), {
          userId: friendId,
          chatId,
          friendId: currentUserId,
          createdAt: new Date(),
        }),
        setDoc(doc(db, 'chats', chatId), {
          participants: [currentUserId, friendId],
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ]);

      Alert.alert('Success', `${profile.displayName} added successfully!`, [
        { text: 'Start Chat', onPress: () => router.push(`/chat/${friendId}`) },
        { text: 'Stay on Profile', onPress: () => setIsFriend(true), style: 'cancel' },
      ]);
    } catch (error) {
      console.error('Error adding friend:', error);
      Alert.alert('Error', 'Failed to add friend.');
    } finally {
      setIsAddingFriend(false);
    }
  };

  const handleUserPress = (userId: string) => {
    router.push({ pathname: '/(tabs)/home/profile', params: { userId } });
  };

  const isOwnProfile = user?.uid === userId;

  if (loading) {
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
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              <View style={styles.profileHeader}>
                {profile?.profileImage ? (
                  <Image source={{ uri: profile.profileImage }} style={styles.profileImage} />
                ) : (
                  <LinearGradient
                    colors={['#9C27B0', '#673AB7']}
                    style={styles.profileImage}
                  >
                    <Text style={styles.avatarText}>
                      {profile?.displayName?.charAt(0).toUpperCase() || 'U'}
                    </Text>
                  </LinearGradient>
                )}
                <Text style={styles.profileName}>{profile?.displayName}</Text>
                <Text style={styles.postCount}>{posts.length} Posts</Text>

                {!isOwnProfile && (
                  <View style={styles.actionButtonContainer}>
                    {isCheckingFriendship ? (
                      <ActivityIndicator size="small" color="#B39DDB" />
                    ) : isFriend ? (
                      <TouchableOpacity style={styles.chatButton} onPress={navigateToChat}>
                        <LinearGradient
                          colors={['#9C27B0', '#673AB7']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.gradientButton}
                        >
                          <FontAwesome name="comments" size={16} color="white" style={styles.buttonIcon} />
                          <Text style={styles.buttonText}>Chat</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.addFriendButton}
                        onPress={addFriend}
                        disabled={isAddingFriend}
                      >
                        <LinearGradient
                          colors={['#9C27B0', '#673AB7']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.gradientButton}
                        >
                          {isAddingFriend ? (
                            <ActivityIndicator size="small" color="white" />
                          ) : (
                            <>
                              <FontAwesome name="user-plus" size={16} color="white" style={styles.buttonIcon} />
                              <Text style={styles.buttonText}>Add Friend</Text>
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            }
            renderItem={({ item }) => (
              <PostCard
                post={item}
                onLike={handleLikePost}
                onComment={openComments}
                onDelete={item.userId === user?.uid ? handleDeletePost : undefined}
                onUserPress={handleUserPress}
                isOwnPost={item.userId === user?.uid}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No posts yet.</Text>
              </View>
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
                          ListEmptyComponent={<Text style={styles.emptyCommentsText}>No comments yet.</Text>}
                        />
                      )}

                      <View style={styles.commentInputContainer}>
                        <TextInput
                          style={styles.commentInput}
                          placeholder="Write a comment..."
                          placeholderTextColor="#9E9E9E"
                          value={newComment}
                          onChangeText={setNewComment}
                          multiline
                          editable={!submittingComment}
                        />
                        <TouchableOpacity
                          style={styles.commentButton}
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
  profileHeader: {
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(179, 157, 219, 0.3)',
    marginBottom: 10,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
    color: '#D1C4E9',
    marginBottom: 5,
  },
  postCount: {
    fontSize: 16,
    color: '#B39DDB',
    marginBottom: 15,
  },
  actionButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  chatButton: {
    borderRadius: 5,
    overflow: 'hidden',
  },
  addFriendButton: {
    borderRadius: 5,
    overflow: 'hidden',
  },
  gradientButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(179, 157, 219, 0.3)',
    borderRadius: 15,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D1C4E9',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
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
    padding: 15,
    backgroundColor: 'rgba(30, 7, 55, 0.7)',
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
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(179, 157, 219, 0.3)',
  },
  commentUserName: {
    fontWeight: 'bold',
    color: '#D1C4E9',
  },
  commentText: {
    marginTop: 5,
    color: '#FFFFFF',
  },
  emptyCommentsText: {
    textAlign: 'center',
    color: '#D1C4E9',
    padding: 20,
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
    borderRadius: 20,
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