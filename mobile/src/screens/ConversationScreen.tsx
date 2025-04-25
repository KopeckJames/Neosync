import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Keyboard,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { API_URL } from '../config';

// Define types for our message data
interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  timestamp: string;
  isEncrypted: boolean;
  sender: User;
  attachments?: Attachment[];
}

interface User {
  id: number;
  username: string;
  avatarColor: string;
}

interface Attachment {
  id: number;
  messageId: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  downloadUrl: string;
  thumbnailUrl?: string;
}

type ConversationScreenProps = {
  route: RouteProp<RootStackParamList, 'Conversation'>;
  navigation: StackNavigationProp<RootStackParamList, 'Conversation'>;
};

export default function ConversationScreen({ route, navigation }: ConversationScreenProps) {
  const { conversationId, title } = route.params;
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const listRef = useRef<FlatList>(null);

  // Keyboard event listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  // Set up navigation options dynamically
  useEffect(() => {
    navigation.setOptions({
      title,
    });
  }, [navigation, title]);

  // Fetch messages
  const {
    data: messages,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['conversations', conversationId, 'messages'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/conversations/${conversationId}/messages`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      
      return response.json() as Promise<Message[]>;
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch(`${API_URL}/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          isEncrypted: true
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      return response.json();
    },
    onSuccess: () => {
      refetch();
    },
  });

  // Handle sending a message
  const handleSend = () => {
    if (message.trim() === '') return;
    
    sendMessageMutation.mutate(message);
    setMessage('');
  };

  // Format the timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Render message bubble
  const renderItem = ({ item }: { item: Message }) => {
    const isMyMessage = item.senderId === user?.id;
    
    return (
      <View style={[
        styles.messageBubbleContainer,
        isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer
      ]}>
        {!isMyMessage && (
          <View style={[
            styles.avatar,
            { backgroundColor: item.sender.avatarColor || '#6366f1' }
          ]}>
            <Text style={styles.avatarText}>
              {item.sender.username.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessage : styles.theirMessage
        ]}>
          {item.isEncrypted && (
            <View style={styles.encryptionBadge}>
              <Text style={styles.encryptionBadgeText}>🔒</Text>
            </View>
          )}
          
          <Text style={styles.messageText}>{item.content}</Text>
          
          {item.attachments && item.attachments.length > 0 && (
            <View style={styles.attachmentsContainer}>
              {item.attachments.map((attachment) => {
                const isImage = attachment.fileType.startsWith('image/');
                return isImage ? (
                  <Image
                    key={attachment.id}
                    source={{ uri: attachment.thumbnailUrl || attachment.downloadUrl }}
                    style={styles.imageAttachment}
                    resizeMode="cover"
                  />
                ) : (
                  <View key={attachment.id} style={styles.fileAttachment}>
                    <Text style={styles.fileAttachmentText}>{attachment.fileName}</Text>
                  </View>
                );
              })}
            </View>
          )}
          
          <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
        </View>
      </View>
    );
  };

  // Render separator between messages
  const renderSeparator = () => (
    <View style={styles.separator} />
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Failed to load messages. Please try again.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          ItemSeparatorComponent={renderSeparator}
          contentContainerStyle={styles.messageList}
          inverted={messages && messages.length > 0}
          onContentSizeChange={() => {
            if (messages && messages.length > 0 && !isKeyboardVisible) {
              listRef.current?.scrollToOffset({ offset: 0, animated: false });
            }
          }}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>
                Start the conversation by sending a message
              </Text>
            </View>
          )}
        />
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Type a message..."
          placeholderTextColor="#6b7280"
          multiline
        />
        
        <TouchableOpacity style={styles.attachButton}>
          <Text style={styles.attachButtonText}>+</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.sendButton,
            message.trim() === '' ? styles.sendButtonDisabled : {}
          ]}
          onPress={handleSend}
          disabled={message.trim() === '' || sendMessageMutation.isPending}
        >
          {sendMessageMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  messageList: {
    padding: 16,
  },
  messageBubbleContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    maxWidth: '80%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  theirMessageContainer: {
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'relative',
  },
  myMessage: {
    backgroundColor: '#6366f1',
  },
  theirMessage: {
    backgroundColor: '#1f1f1f',
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
  },
  messageTime: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  encryptionBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    zIndex: 1,
  },
  encryptionBadgeText: {
    fontSize: 12,
  },
  attachmentsContainer: {
    marginTop: 8,
  },
  imageAttachment: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 4,
  },
  fileAttachment: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
  },
  fileAttachmentText: {
    color: '#fff',
    fontSize: 14,
  },
  separator: {
    height: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#1f1f1f',
    backgroundColor: '#0a0a0a',
  },
  input: {
    flex: 1,
    backgroundColor: '#1f1f1f',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
    maxHeight: 100,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1f1f1f',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  attachButtonText: {
    fontSize: 24,
    color: '#6366f1',
  },
  sendButton: {
    width: 60,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#3f3f46',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
});