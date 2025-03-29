import * as Notifications from 'expo-notifications';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Service for handling notification-related functionality
 */
export class NotificationService {
  /**
   * Saves the user's Expo Push Token to Firestore
   */
  static async saveExpoTokenToDatabase(userId: string, token: string): Promise<void> {
    const userTokenRef = doc(db, 'userTokens', userId);
    const tokenDoc = await getDoc(userTokenRef);
    
    if (tokenDoc.exists()) {
      await updateDoc(userTokenRef, {
        expoPushToken: token,
        updatedAt: new Date()
      });
    } else {
      await setDoc(userTokenRef, {
        userId,
        expoPushToken: token,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  /**
   * Gets a user's push token
   */
  static async getUserPushToken(userId: string): Promise<string | null> {
    try {
      const userTokenRef = doc(db, 'userTokens', userId);
      const tokenDoc = await getDoc(userTokenRef);
      
      if (tokenDoc.exists() && tokenDoc.data().expoPushToken) {
        return tokenDoc.data().expoPushToken;
      }
      return null;
    } catch (error) {
      console.error('Error getting user push token:', error);
      return null;
    }
  }

  /**
   * Sends a local notification immediately
   */
  static async sendLocalNotification(
    title: string, 
    body: string, 
    data: any = {}
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger: null, // null means show immediately
      });
    } catch (error) {
      console.error('Error sending local notification:', error);
    }
  }

  /**
   * Records a notification in Firestore for analytics and history
   */
  static async recordNotification(
    userId: string, 
    title: string, 
    body: string, 
    data: any = {}
  ): Promise<void> {
    try {
      await addDoc(collection(db, 'users', userId, 'notifications'), {
        title,
        body,
        data,
        isRead: false,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Error recording notification:', error);
    }
  }

  /**
   * Marks a notification as read
   */
  static async markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
    try {
      const notificationRef = doc(db, 'users', userId, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        isRead: true,
        readAt: new Date()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  /**
   * Handles a new message by sending notification and updating relevant data
   */
  static async handleNewMessage(
    messageData: any, 
    senderName: string, 
    recipientId: string, 
    chatId: string
  ): Promise<void> {
    try {
      // Get recipient's push token
      const recipientToken = await NotificationService.getUserPushToken(recipientId);
      
      // Create notification content
      const title = senderName;
      const body = messageData.text || 'New message';
      const data = {
        chatId,
        senderId: messageData.senderId,
        type: 'new_message'
      };
      
      // Send local notification if the user is on the device
      await NotificationService.sendLocalNotification(title, body, data);
      
      // Record the notification in Firestore
      await NotificationService.recordNotification(recipientId, title, body, data);
      
      // If we have a push token and want to send remote notifications,
      // you would call your backend service here
      if (recipientToken) {
        // Note: In a production app, you would call your backend API
        // The backend would then use Expo Push API or Firebase Cloud Messaging
        console.log('Would send push notification to token:', recipientToken);
      }
    } catch (error) {
      console.error('Error handling new message notification:', error);
    }
  }
}