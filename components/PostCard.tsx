import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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
}

interface PostCardProps {
  post: Post;
  onLike: (postId: string) => void;
  onComment: (post: Post) => void;
  onDelete?: (postId: string) => void;
  onUserPress: (userId: string) => void;
  isOwnPost: boolean;
}

export const PostCard: React.FC<PostCardProps> = ({ 
  post, 
  onLike, 
  onComment, 
  onDelete, 
  onUserPress, 
  isOwnPost 
}) => {
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

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <TouchableOpacity 
          onPress={() => onUserPress(post.userId)}
          style={styles.avatarContainer}
        >
          {post.userImage ? (
            <Image source={{ uri: post.userImage }} style={styles.postAvatar} />
          ) : (
            <LinearGradient
              colors={['#4facfe', '#00f2fe']}
              style={styles.postAvatar}
            >
              <Text style={styles.avatarText}>{post.userName.charAt(0).toUpperCase()}</Text>
            </LinearGradient>
          )}
        </TouchableOpacity>
        
        <View style={styles.postHeaderInfo}>
          <TouchableOpacity onPress={() => onUserPress(post.userId)}>
            <Text style={styles.postUserName}>{post.userName}</Text>
          </TouchableOpacity>
          <Text style={styles.postTime}>{formatTime(post.timestamp)}</Text>
        </View>
        
        {isOwnPost && onDelete && (
          <TouchableOpacity 
            style={styles.deletePostButton} 
            onPress={() => onDelete(post.id)}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <FontAwesome name="trash" size={16} color="#e74c3c" />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.postText}>{post.text}</Text>

      {(post.likeCount > 0 || post.commentCount > 0) && (
        <View style={styles.postStats}>
          {post.likeCount > 0 && (
            <View style={styles.statItem}>
              <View style={styles.likeIconContainer}>
                <FontAwesome name="thumbs-up" size={12} color="white" />
              </View>
              <Text style={styles.statText}>{post.likeCount}</Text>
            </View>
          )}
          
          {post.commentCount > 0 && (
            <Text style={styles.statText}>
              {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
            </Text>
          )}
        </View>
      )}

      <View style={styles.divider} />

      <View style={styles.postActions}>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => onLike(post.id)}
        >
          <FontAwesome
            name={post.isLikedByMe ? 'thumbs-up' : 'thumbs-o-up'}
            size={18}
            color={post.isLikedByMe ? '#3498db' : '#7f8c8d'}
          />
          <Text 
            style={[
              styles.actionButtonText, 
              post.isLikedByMe && styles.activeActionText
            ]}
          >
            Like
          </Text>
        </TouchableOpacity>
        
        <View style={styles.actionDivider} />
        
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => onComment(post)}
        >
          <FontAwesome name="comment-o" size={18} color="#7f8c8d" />
          <Text style={styles.actionButtonText}>Comment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  postCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    marginHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
    overflow: 'hidden',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatarContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  postAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  postHeaderInfo: {
    flex: 1,
  },
  postUserName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 2,
  },
  postTime: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  deletePostButton: {
    padding: 6,
  },
  postText: {
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  postStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeIconContainer: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  statText: {
    fontSize: 13,
    color: '#7f8c8d',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 16,
  },
  postActions: {
    flexDirection: 'row',
    padding: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  actionDivider: {
    width: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
  },
  actionButtonText: {
    marginLeft: 8,
    color: '#7f8c8d',
    fontSize: 14,
    fontWeight: '500',
  },
  activeActionText: {
    color: '#3498db',
    fontWeight: '600',
  },
});