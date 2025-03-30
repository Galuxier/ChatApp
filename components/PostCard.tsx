import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

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
  onUserPress: (userId: string) => void; // เพิ่ม prop ใหม่
  isOwnPost: boolean;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onLike, onComment, onDelete, onUserPress, isOwnPost }) => {
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
        {post.userImage ? (
          <Image source={{ uri: post.userImage }} style={styles.postAvatar} />
        ) : (
          <View style={styles.postAvatar}>
            <Text style={styles.avatarText}>{post.userName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.postHeaderInfo}>
          <TouchableOpacity onPress={() => onUserPress(post.userId)}>
            <Text style={styles.postUserName}>{post.userName}</Text>
          </TouchableOpacity>
          <Text style={styles.postTime}>{formatTime(post.timestamp)}</Text>
        </View>
        {isOwnPost && onDelete && (
          <TouchableOpacity style={styles.deletePostButton} onPress={() => onDelete(post.id)}>
            <FontAwesome name="trash" size={18} color="#e74c3c" />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.postText}>{post.text}</Text>

      <View style={styles.postStats}>
        {post.likeCount > 0 && (
          <Text style={styles.statText}>
            <FontAwesome name="thumbs-up" size={12} color="#3498db" /> {post.likeCount}
          </Text>
        )}
        {post.commentCount > 0 && (
          <Text style={styles.statText}>
            {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
          </Text>
        )}
      </View>

      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => onLike(post.id)}>
          <FontAwesome
            name={post.isLikedByMe ? 'thumbs-up' : 'thumbs-o-up'}
            size={18}
            color={post.isLikedByMe ? '#3498db' : '#7f8c8d'}
          />
          <Text style={[styles.actionButtonText, post.isLikedByMe && styles.activeActionText]}>
            Like
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => onComment(post)}>
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
});