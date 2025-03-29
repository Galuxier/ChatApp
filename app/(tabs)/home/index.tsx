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
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
  comments?: Comment[];
  isLikedByMe?: boolean;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
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
            profileImage: data.profileImage || null,
          });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, [user]);
  
  // Get list of friend IDs
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

  // Fetch posts from friends
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
      Alert.alert('Error', 'Could not load posts. Please try again later.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (friendIds.length > 0) {
      fetchPosts();
    }
  }, [friendIds]);

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
      Alert.alert('Error', 'Could not create post. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const handleLikePost = async (postId: string) => {
    if (!user) return;
    
    try {
      const postRef = doc(db, 'posts', postId);
      const postDoc = await getDoc(postRef);
      
      if (!postDoc.exists()) {
        console.error('Post not found');
        return;
      }
      
      const postData = postDoc.data();
      const likes = postData.likes || [];
      const isLiked = likes.some((like: any) => like.userId === user.uid);
      
      if (isLiked) {
        await updateDoc(postRef, {
          likes: likes.filter((like: any) => like.userId !== user.uid),
        });
        
        setPosts(posts.map(post => 
          post.id === postId 
            ? { 
                ...post, 
                likes: post.likes.filter(like => like.userId !== user.uid),
                likeCount: post.likeCount - 1,
                isLikedByMe: false 
              } 
            : post
        ));
      } else {
        const newLike = {
          userId: user.uid,
          timestamp: new Date(),
        };
        
        await updateDoc(postRef, {
          likes: [...likes, newLike],
        });
        
        setPosts(posts.map(post => 
          post.id === postId 
            ? { 
                ...post, 
                likes: [...post.likes, newLike],
                likeCount: post.likeCount + 1,
                isLikedByMe: true 
              } 
            : post
        ));
      }
    } catch (error) {
      console.error('Error updating like:', error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!user) return;

    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
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
              Alert.alert('Error', 'Could not delete post. Please try again.');
            }
          },
        },
      ]
    );
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
      
      setSelectedPost({ ...post, comments: commentsData });
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
      
      await addDoc(collection(db, 'posts', selectedPost.id, 'comments'), newCommentData);
      
      setNewComment('');
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : { displayName: 'Unknown User' };
      
      const newCommentObj: Comment = {
        id: 'temp-id', // ID ชั่วคราว จะดีกว่าถ้าใช้ ID จริงจาก Firestore
        userId: user.uid,
        userName: userData.displayName || 'Unknown User',
        userImage: userData.profileImage || null,
        text: newCommentData.text,
        timestamp: newCommentData.timestamp,
      };
      
      if (selectedPost.comments) {
        setSelectedPost({
          ...selectedPost,
          comments: [newCommentObj, ...selectedPost.comments],
          commentCount: selectedPost.commentCount + 1,
        });
      }
      
      setPosts(posts.map(post => 
        post.id === selectedPost.id 
          ? { ...post, commentCount: post.commentCount + 1 } 
          : post
      ));
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Could not add comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user || !selectedPost) return;

    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'posts', selectedPost.id, 'comments', commentId));
              
              if (selectedPost.comments) {
                const updatedComments = selectedPost.comments.filter(comment => comment.id !== commentId);
                setSelectedPost({
                  ...selectedPost,
                  comments: updatedComments,
                  commentCount: selectedPost.commentCount - 1,
                });
                setPosts(posts.map(post => 
                  post.id === selectedPost.id 
                    ? { ...post, commentCount: post.commentCount - 1 } 
                    : post
                ));
              }
            } catch (error) {
              console.error('Error deleting comment:', error);
              Alert.alert('Error', 'Could not delete comment. Please try again.');
            }
          },
        },
      ]
    );
  };

  const goToProfile = (userId: string) => {
    // ปิด Modal และรีเซ็ต state ก่อนนำทาง
    if (commentModalVisible) {
      setCommentModalVisible(false);
      setSelectedPost(null);
      setNewComment('');
    }
    router.push({ pathname: '/(tabs)/home/profile', params: { userId } });
  };

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
                (!newPostText.trim() || posting) && styles.disabledButton,
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
                <TouchableOpacity onPress={() => goToProfile(item.userId)}>
                  <Text style={styles.postUserName}>{item.userName}</Text>
                </TouchableOpacity>
                <Text style={styles.postTime}>{formatTime(item.timestamp)}</Text>
              </View>
              {item.userId === user?.uid && (
                <TouchableOpacity
                  style={styles.deletePostButton}
                  onPress={() => handleDeletePost(item.id)}
                >
                  <FontAwesome name="trash" size={18} color="#e74c3c" />
                </TouchableOpacity>
              )}
            </View>
            
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
            
            <View style={styles.postActions}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => handleLikePost(item.id)}
              >
                <FontAwesome 
                  name={item.isLikedByMe ? "thumbs-up" : "thumbs-o-up"} 
                  size={18} 
                  color={item.isLikedByMe ? "#3498db" : "#7f8c8d"} 
                />
                <Text 
                  style={[
                    styles.actionButtonText, 
                    item.isLikedByMe && styles.activeActionText,
                  ]}
                >
                  Like
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => openCommentModal(item)}
              >
                <FontAwesome name="comment-o" size={18} color="#7f8c8d" />
                <Text style={styles.actionButtonText}>Comment</Text>
              </TouchableOpacity>
            </View>
          </View>
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
      
      {/* Comments Modal */}
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={() => {
                setCommentModalVisible(false);
                setSelectedPost(null);
                setNewComment('');
              }}
            >
              <FontAwesome name="arrow-left" size={20} color="#3498db" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Comments</Text>
            <View style={styles.headerSpacer} />
          </View>
          
          {selectedPost && (
            <>
              <View style={styles.modalPostPreview}>
                <View style={styles.previewHeader}>
                  {selectedPost.userImage ? (
                    <Image source={{ uri: selectedPost.userImage }} style={styles.previewAvatar} />
                  ) : (
                    <View style={styles.previewAvatar}>
                      <Text style={styles.avatarText}>
                        {selectedPost.userName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity onPress={() => goToProfile(selectedPost.userId)}>
                    <Text style={styles.previewUserName}>{selectedPost.userName}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.previewText}>{selectedPost.text}</Text>
              </View>
              
              {loadingComments ? (
                <View style={styles.loadingCommentsContainer}>
                  <ActivityIndicator size="small" color="#3498db" />
                </View>
              ) : (
                <FlatList
                  data={selectedPost.comments}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <View style={styles.commentItem}>
                      {item.userImage ? (
                        <Image source={{ uri: item.userImage }} style={styles.commentAvatar} />
                      ) : (
                        <View style={styles.commentAvatar}>
                          <Text style={styles.commentAvatarText}>
                            {item.userName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.commentContent}>
                        <View style={styles.commentHeader}>
                          <TouchableOpacity onPress={() => goToProfile(item.userId)}>
                            <Text style={styles.commentUserName}>{item.userName}</Text>
                          </TouchableOpacity>
                          {item.userId === user?.uid && (
                            <TouchableOpacity
                              style={styles.deleteCommentButton}
                              onPress={() => handleDeleteComment(item.id)}
                            >
                              <FontAwesome name="trash" size={16} color="#e74c3c" />
                            </TouchableOpacity>
                          )}
                        </View>
                        <Text style={styles.commentText}>{item.text}</Text>
                        <Text style={styles.commentTime}>{formatTime(item.timestamp)}</Text>
                      </View>
                    </View>
                  )}
                  ListEmptyComponent={
                    <View style={styles.emptyCommentsContainer}>
                      <Text style={styles.emptyCommentsText}>No comments yet.</Text>
                      <Text style={styles.emptyCommentsSubText}>Be the first to comment!</Text>
                    </View>
                  }
                  contentContainerStyle={styles.commentsList}
                />
              )}
            </>
          )}
          
          <View style={styles.commentInputContainer}>
            <TextInput
              ref={commentInputRef}
              style={styles.commentInput}
              placeholder="Write a comment..."
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={500}
              editable={!submittingComment}
              autoFocus={true}
            />
            <TouchableOpacity
              style={[
                styles.commentButton,
                (!newComment.trim() || submittingComment) && styles.disabledButton,
              ]}
              onPress={addComment}
              disabled={!newComment.trim() || submittingComment}
            >
              {submittingComment ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <FontAwesome name="send" size={18} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  deletePostButton: {
    padding: 5,
  },
  postText: {
    fontSize: 16,
    color: '#2c3e50',
    marginBottom: 15,
    lineHeight: 22,
  },
  postStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 10,
    marginBottom: 10,
  },
  statText: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 20,
  },
  actionButtonText: {
    marginLeft: 5,
    color: '#7f8c8d',
    fontSize: 14,
  },
  activeActionText: {
    color: '#3498db',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: 'white',
    marginTop: 10,
    borderRadius: 10,
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
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 30,
  },
  modalPostPreview: {
    backgroundColor: 'white',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  previewAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  previewUserName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  previewText: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 20,
  },
  loadingCommentsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentsList: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    flexGrow: 1,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 15,
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  commentAvatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  commentContent: {
    flex: 1,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  deleteCommentButton: {
    padding: 5,
  },
  commentText: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 18,
  },
  commentTime: {
    fontSize: 12,
    color: '#7f8c8d',
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
    color: '#7f8c8d',
  },
  emptyCommentsSubText: {
    fontSize: 14,
    color: '#95a5a6',
    marginTop: 5,
  },
  commentInputContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    marginRight: 10,
  },
  commentButton: {
    backgroundColor: '#3498db',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});