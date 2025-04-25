import express, { type Express, type Request, type Response } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { 
  insertContactSchema, 
  insertMessageSchema, 
  insertAttachmentSchema,
  insertMessageReactionSchema,
  insertGroupMemberSchema,
  User, 
  Attachment, 
  AttachmentWithThumbnail,
  Message
} from "@shared/schema";
import { ZodError } from "zod";
import { 
  upload, 
  generateThumbnail, 
  getRelativePath, 
  ensureDirectories,
  isImageFile, 
  isVideoFile, 
  isAudioFile 
} from "./file-utils";

// WebSocket clients mapping (userId -> WebSocket)
const wsClients = new Map<number, WebSocket>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Sets up auth routes (/api/register, /api/login, /api/logout, /api/user)
  setupAuth(app);

  // Ensure uploads directories exist
  await ensureDirectories();

  // Serve uploads directory for attachments
  app.use('/uploads', (req, res, next) => {
    // Only allow authenticated users to access uploads
    if (!req.isAuthenticated()) {
      return res.status(401).send('Unauthorized');
    }
    next();
  }, (req, res, next) => {
    // Set cache control headers
    res.set('Cache-Control', 'private, max-age=3600'); // 1 hour cache
    next();
  }, express.static(path.join(process.cwd(), 'uploads')));

  const httpServer = createServer(app);
  
  // Set up WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws, req) => {
    // Get session ID from cookies
    let userId: number | undefined = undefined;
    
    // Handle messages from client
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Handle authentication
        if (message.type === 'authenticate' && message.userId) {
          userId = Number(message.userId);
          if (isNaN(userId)) {
            console.error('Invalid userId:', message.userId);
            return;
          }
          
          wsClients.set(userId, ws);
          
          // Update user status to online
          await storage.updateUserStatus(userId, true);
          
          // Notify contacts that user is online
          const contacts = await storage.getContacts(userId);
          for (const contact of contacts) {
            const contactWs = wsClients.get(contact.id);
            if (contactWs && contactWs.readyState === WebSocket.OPEN) {
              contactWs.send(JSON.stringify({
                type: 'status_update',
                userId: userId,
                isOnline: true
              }));
            }
          }
        }
        
        // Handle typing indicator events
        else if (message.type === 'typing' && userId && message.conversationId && message.receiverId) {
          const receiverWs = wsClients.get(message.receiverId);
          if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
            receiverWs.send(JSON.stringify({
              type: 'typing',
              userId: userId,
              conversationId: message.conversationId
            }));
          }
        }
        
        // Handle typing stopped events
        else if (message.type === 'typing_stop' && userId && message.conversationId && message.receiverId) {
          const receiverWs = wsClients.get(message.receiverId);
          if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
            receiverWs.send(JSON.stringify({
              type: 'typing_stop',
              userId: userId,
              conversationId: message.conversationId
            }));
          }
        }
        
        // Handle WebRTC call request
        else if (message.type === 'call-request' && userId && message.contactId) {
          const receiverId = message.contactId;
          const receiverWs = wsClients.get(Number(receiverId));
          
          if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
            receiverWs.send(JSON.stringify({
              type: 'call-request',
              from: userId,
              to: receiverId,
              mediaType: message.mediaType || 'audio',
              sessionId: message.sessionId
            }));
          } else {
            // Receiver is offline, send call-failed response
            ws.send(JSON.stringify({
              type: 'call-failed',
              to: userId,
              from: receiverId,
              reason: 'User is offline'
            }));
          }
        }
        
        // Handle call accepted
        else if (message.type === 'call-accepted' && userId && message.contactId) {
          const receiverId = message.contactId;
          const receiverWs = wsClients.get(Number(receiverId));
          
          if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
            receiverWs.send(JSON.stringify({
              type: 'call-accepted',
              from: userId,
              to: receiverId,
              sessionId: message.sessionId
            }));
          }
        }
        
        // Handle call rejected
        else if (message.type === 'call-rejected' && userId && message.contactId) {
          const receiverId = message.contactId;
          const receiverWs = wsClients.get(Number(receiverId));
          
          if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
            receiverWs.send(JSON.stringify({
              type: 'call-rejected',
              from: userId,
              to: receiverId,
              sessionId: message.sessionId,
              reason: message.reason || 'Call declined'
            }));
          }
        }
        
        // Handle call ended
        else if (message.type === 'call-ended' && userId && message.contactId) {
          const receiverId = message.contactId;
          const receiverWs = wsClients.get(Number(receiverId));
          
          if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
            receiverWs.send(JSON.stringify({
              type: 'call-ended',
              from: userId,
              to: receiverId,
              sessionId: message.sessionId
            }));
          }
        }
        
        // Handle WebRTC signaling
        else if (message.type === 'webrtc-signal' && userId && message.payload) {
          const payload = message.payload;
          const receiverId = payload.to;
          const receiverWs = wsClients.get(Number(receiverId));
          
          if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
            // Forward the WebRTC signal to the recipient
            receiverWs.send(JSON.stringify({
              type: 'webrtc-signal',
              payload: {
                ...payload,
                from: userId // Ensure the from field is correct
              }
            }));
          }
        }
        
        // Handle message reactions via WebSocket
        else if (message.type === 'add_reaction' && userId && message.messageId && message.reaction) {
          try {
            // Get the message
            const msg = await storage.getMessageById(message.messageId);
            if (!msg) return;
            
            // Add the reaction
            const reaction = await storage.addMessageReaction({
              messageId: message.messageId,
              userId,
              reaction: message.reaction
            });
            
            // Get user data
            const user = await storage.getUser(userId);
            if (!user) return;
            const { password, ...userWithoutPassword } = user;
            
            const reactionWithUser = {
              ...reaction,
              user: userWithoutPassword
            };
            
            // Get the conversation to notify other participants
            const conversation = await storage.getConversationById(msg.conversationId);
            if (!conversation) return;
            
            // Notify other users
            if (conversation.isGroup) {
              const members = await storage.getGroupMembers(conversation.id);
              for (const member of members) {
                if (member.userId !== userId) {
                  const memberWs = wsClients.get(member.userId);
                  if (memberWs && memberWs.readyState === WebSocket.OPEN) {
                    memberWs.send(JSON.stringify({
                      type: 'message_reaction',
                      conversationId: conversation.id,
                      messageId: message.messageId,
                      reaction: reactionWithUser
                    }));
                  }
                }
              }
            } else {
              const otherUserId = conversation.user1Id === userId 
                ? conversation.user2Id 
                : conversation.user1Id;
                
              if (otherUserId) {
                const otherUserWs = wsClients.get(otherUserId);
                if (otherUserWs && otherUserWs.readyState === WebSocket.OPEN) {
                  otherUserWs.send(JSON.stringify({
                    type: 'message_reaction',
                    conversationId: conversation.id,
                    messageId: message.messageId,
                    reaction: reactionWithUser
                  }));
                }
              }
            }
          } catch (error) {
            console.error('Error handling add_reaction:', error);
          }
        }
        
        // Handle message edits via WebSocket
        else if (message.type === 'edit_message' && userId && message.messageId && message.content) {
          try {
            // Get the message
            const msg = await storage.getMessageById(message.messageId);
            if (!msg) return;
            
            // Verify the user is the sender
            if (msg.senderId !== userId) return;
            
            // Optional encryption details
            const encryptionDetails = message.isEncrypted ? {
              isEncrypted: true,
              encryptionType: message.encryptionType || 'sodium',
              nonce: message.nonce
            } : undefined;
            
            // Edit the message
            const updatedMessage = await storage.editMessage(
              message.messageId,
              message.content,
              encryptionDetails
            );
            
            // Get user data
            const user = await storage.getUser(userId);
            if (!user) return;
            const { password, ...userWithoutPassword } = user;
            
            // Get edit history
            const edits = await storage.getMessageEdits(message.messageId);
            
            const messageWithUser = {
              ...updatedMessage,
              sender: userWithoutPassword,
              edits
            };
            
            // Get the conversation to notify other participants
            const conversation = await storage.getConversationById(msg.conversationId);
            if (!conversation) return;
            
            // Notify other users
            if (conversation.isGroup) {
              const members = await storage.getGroupMembers(conversation.id);
              for (const member of members) {
                if (member.userId !== userId) {
                  const memberWs = wsClients.get(member.userId);
                  if (memberWs && memberWs.readyState === WebSocket.OPEN) {
                    memberWs.send(JSON.stringify({
                      type: 'message_edited',
                      message: messageWithUser
                    }));
                  }
                }
              }
            } else {
              const otherUserId = conversation.user1Id === userId 
                ? conversation.user2Id 
                : conversation.user1Id;
                
              if (otherUserId) {
                const otherUserWs = wsClients.get(otherUserId);
                if (otherUserWs && otherUserWs.readyState === WebSocket.OPEN) {
                  otherUserWs.send(JSON.stringify({
                    type: 'message_edited',
                    message: messageWithUser
                  }));
                }
              }
            }
          } catch (error) {
            console.error('Error handling edit_message:', error);
          }
        }
        
        // Handle message deletion via WebSocket
        else if (message.type === 'delete_message' && userId && message.messageId) {
          try {
            // Get the message
            const msg = await storage.getMessageById(message.messageId);
            if (!msg) return;
            
            // Verify the user is the sender
            if (msg.senderId !== userId) return;
            
            // Delete the message
            await storage.deleteMessage(message.messageId);
            
            // Get the conversation to notify other participants
            const conversation = await storage.getConversationById(msg.conversationId);
            if (!conversation) return;
            
            // Notify other users
            if (conversation.isGroup) {
              const members = await storage.getGroupMembers(conversation.id);
              for (const member of members) {
                if (member.userId !== userId) {
                  const memberWs = wsClients.get(member.userId);
                  if (memberWs && memberWs.readyState === WebSocket.OPEN) {
                    memberWs.send(JSON.stringify({
                      type: 'message_deleted',
                      conversationId: conversation.id,
                      messageId: message.messageId
                    }));
                  }
                }
              }
            } else {
              const otherUserId = conversation.user1Id === userId 
                ? conversation.user2Id 
                : conversation.user1Id;
                
              if (otherUserId) {
                const otherUserWs = wsClients.get(otherUserId);
                if (otherUserWs && otherUserWs.readyState === WebSocket.OPEN) {
                  otherUserWs.send(JSON.stringify({
                    type: 'message_deleted',
                    conversationId: conversation.id,
                    messageId: message.messageId
                  }));
                }
              }
            }
          } catch (error) {
            console.error('Error handling delete_message:', error);
          }
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });
    
    // Handle disconnection
    ws.on('close', async () => {
      if (userId !== undefined) {
        wsClients.delete(userId);
        
        // Update user status to offline
        await storage.updateUserStatus(userId, false);
        
        // Notify contacts that user is offline
        const contacts = await storage.getContacts(userId);
        for (const contact of contacts) {
          const contactWs = wsClients.get(contact.id);
          if (contactWs && contactWs.readyState === WebSocket.OPEN) {
            contactWs.send(JSON.stringify({
              type: 'status_update',
              userId: userId,
              isOnline: false
            }));
          }
        }
      }
    });
  });
  
  // Encryption key routes
  
  // Store user's public key
  app.post('/api/keys', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const { userId, publicKey } = req.body;
      const currentUser = req.user as User;
      
      // Only the user can store their own key
      if (userId !== currentUser.id) {
        return res.status(403).send('Forbidden');
      }
      
      await storage.storeUserKey(userId, publicKey);
      
      res.status(201).json({ success: true });
    } catch (error) {
      console.error('Error storing user key:', error);
      res.status(500).send('Server error');
    }
  });
  
  // Get a user's public key
  app.get('/api/keys/:userId', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const userId = parseInt(req.params.userId);
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).send('User not found');
      }
      
      // Get public key
      const publicKey = await storage.getUserKey(userId);
      if (!publicKey) {
        return res.status(404).send('Public key not found');
      }
      
      res.json({ userId, publicKey });
    } catch (error) {
      console.error('Error getting user key:', error);
      res.status(500).send('Server error');
    }
  });

  // API Routes
  
  // Get all users (to add contacts)
  app.get('/api/users', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const currentUser = req.user as User;
      const allUsers = Array.from((await Promise.all(
        Array.from(Array(1000).keys()).map(id => storage.getUser(id + 1))
      )).filter(Boolean) as User[]);
      
      // Remove password and current user
      const users = allUsers
        .filter(user => user.id !== currentUser.id)
        .map(({ password, ...rest }) => rest);
      
      res.json(users);
    } catch (error) {
      res.status(500).send('Server error');
    }
  });
  
  // Get user contacts
  app.get('/api/contacts', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const currentUser = req.user as User;
      const contacts = await storage.getContacts(currentUser.id);
      
      // Remove password
      const safeContacts = contacts.map(({ password, ...rest }) => rest);
      
      res.json(safeContacts);
    } catch (error) {
      res.status(500).send('Server error');
    }
  });
  
  // Add contact
  app.post('/api/contacts', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const currentUser = req.user as User;
      const contactData = insertContactSchema.parse({
        userId: currentUser.id,
        contactId: req.body.contactId
      });
      
      // Check if user exists
      const contactUser = await storage.getUser(contactData.contactId);
      if (!contactUser) {
        return res.status(404).send('User not found');
      }
      
      // Check if already a contact
      const currentContacts = await storage.getContacts(currentUser.id);
      if (currentContacts.some(c => c.id === contactData.contactId)) {
        return res.status(400).send('Already a contact');
      }
      
      // Add to contacts (both ways for simplicity)
      await storage.addContact(contactData);
      await storage.addContact({
        userId: contactData.contactId,
        contactId: currentUser.id
      });
      
      // Return the contact user info
      const { password, ...contactInfo } = contactUser;
      res.status(201).json(contactInfo);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).send('Server error');
    }
  });
  
  // Get conversations
  app.get('/api/conversations', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const currentUser = req.user as User;
      const conversations = await storage.getUserConversations(currentUser.id);
      
      // Remove password from contact
      const safeConversations = conversations.map(conv => ({
        ...conv,
        contact: {
          ...conv.contact,
          password: undefined
        }
      }));
      
      res.json(safeConversations);
    } catch (error) {
      res.status(500).send('Server error');
    }
  });
  
  // Get messages for a conversation
  app.get('/api/conversations/:id/messages', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const currentUser = req.user as User;
      const conversationId = parseInt(req.params.id);
      
      // Check if conversation exists and user is part of it
      const conversation = await storage.getConversationById(conversationId);
      if (!conversation) {
        return res.status(404).send('Conversation not found');
      }
      
      if (conversation.user1Id !== currentUser.id && conversation.user2Id !== currentUser.id) {
        return res.status(403).send('Access denied');
      }
      
      // Get messages
      const messages = await storage.getMessages(conversationId);
      
      // Mark received messages as read
      await storage.markMessagesAsRead(conversationId, currentUser.id);
      
      // Notify the sender that messages were read
      const otherUserId = conversation.user1Id === currentUser.id 
        ? conversation.user2Id 
        : conversation.user1Id;
        
      const otherUserWs = wsClients.get(otherUserId);
      if (otherUserWs && otherUserWs.readyState === WebSocket.OPEN) {
        otherUserWs.send(JSON.stringify({
          type: 'messages_read',
          conversationId: conversationId,
          readBy: currentUser.id
        }));
      }
      
      res.json(messages);
    } catch (error) {
      res.status(500).send('Server error');
    }
  });
  
  // File Upload Routes - moved to a separate section below
  
  // Send a message with optional attachment
  app.post('/api/messages', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const currentUser = req.user as User;
      
      // Get or create conversation
      const conversation = await storage.getOrCreateConversation(
        currentUser.id, 
        req.body.receiverId
      );
      
      // Create message
      const messageData = insertMessageSchema.parse({
        conversationId: conversation.id,
        senderId: currentUser.id,
        receiverId: req.body.receiverId,
        content: req.body.content,
        isEncrypted: req.body.isEncrypted !== false, // Default to true
        encryptionType: req.body.encryptionType || 'sodium',
        nonce: req.body.nonce, // Encrypted message nonce
        timestamp: new Date(),
        isRead: false
      });
      
      const message = await storage.createMessage(messageData);
      
      // Get the sender info to attach to the message
      const sender = await storage.getUser(message.senderId);
      if (!sender) {
        return res.status(404).send('Sender not found');
      }
      
      const { password, ...senderWithoutPassword } = sender;
      const messageWithUser = {
        ...message,
        sender: senderWithoutPassword
      };
      
      // Send message to receiver if they're online
      const receiverWs = wsClients.get(req.body.receiverId);
      if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
        receiverWs.send(JSON.stringify({
          type: 'new_message',
          message: messageWithUser
        }));
      }
      
      res.status(201).json(messageWithUser);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).send('Server error');
    }
  });

  // Message reaction endpoints
  
  // Add a reaction to a message
  app.post('/api/messages/:messageId/reactions', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const currentUser = req.user as User;
      const messageId = parseInt(req.params.messageId);
      
      // Get the message to check if it exists and if the user has access to it
      const message = await storage.getMessageById(messageId);
      if (!message) {
        return res.status(404).send('Message not found');
      }
      
      // Get the conversation to verify access rights
      const conversation = await storage.getConversationById(message.conversationId);
      if (!conversation) {
        return res.status(404).send('Conversation not found');
      }
      
      // Verify user is part of the conversation
      const isGroupConversation = conversation.isGroup;
      if (isGroupConversation) {
        // For group chats, check if user is a member
        const members = await storage.getGroupMembers(conversation.id);
        const isMember = members.some(member => member.userId === currentUser.id);
        if (!isMember) {
          return res.status(403).send('You are not a member of this conversation');
        }
      } else {
        // For direct messages, check if user is part of the conversation
        if (conversation.user1Id !== currentUser.id && conversation.user2Id !== currentUser.id) {
          return res.status(403).send('Access denied');
        }
      }
      
      // Create the reaction
      const reactionData = insertMessageReactionSchema.parse({
        messageId,
        userId: currentUser.id,
        reaction: req.body.reaction
      });
      
      const reaction = await storage.addMessageReaction(reactionData);
      
      // Get user data to include in response
      const { password, ...userWithoutPassword } = currentUser;
      const reactionWithUser = {
        ...reaction,
        user: userWithoutPassword
      };
      
      // Notify other users in the conversation via WebSocket
      if (isGroupConversation) {
        // For group chats, notify all members except the current user
        const members = await storage.getGroupMembers(conversation.id);
        for (const member of members) {
          if (member.userId !== currentUser.id) {
            const memberWs = wsClients.get(member.userId);
            if (memberWs && memberWs.readyState === WebSocket.OPEN) {
              memberWs.send(JSON.stringify({
                type: 'message_reaction',
                conversationId: conversation.id,
                messageId,
                reaction: reactionWithUser
              }));
            }
          }
        }
      } else {
        // For direct messages, notify the other user
        const otherUserId = conversation.user1Id === currentUser.id 
          ? conversation.user2Id 
          : conversation.user1Id;
          
        if (otherUserId) {
          const otherUserWs = wsClients.get(otherUserId);
          if (otherUserWs && otherUserWs.readyState === WebSocket.OPEN) {
            otherUserWs.send(JSON.stringify({
              type: 'message_reaction',
              conversationId: conversation.id,
              messageId,
              reaction: reactionWithUser
            }));
          }
        }
      }
      
      res.status(201).json(reactionWithUser);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error('Error adding reaction:', error);
      res.status(500).send('Server error');
    }
  });
  
  // Remove a reaction from a message
  app.delete('/api/messages/:messageId/reactions/:reaction', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const currentUser = req.user as User;
      const messageId = parseInt(req.params.messageId);
      const reaction = req.params.reaction;
      
      // Get the message to check if it exists
      const message = await storage.getMessageById(messageId);
      if (!message) {
        return res.status(404).send('Message not found');
      }
      
      await storage.removeMessageReaction(messageId, currentUser.id, reaction);
      
      // Get the conversation to notify other users
      const conversation = await storage.getConversationById(message.conversationId);
      if (conversation) {
        // Notify other users that the reaction was removed
        if (conversation.isGroup) {
          // For group chats, notify all members except the current user
          const members = await storage.getGroupMembers(conversation.id);
          for (const member of members) {
            if (member.userId !== currentUser.id) {
              const memberWs = wsClients.get(member.userId);
              if (memberWs && memberWs.readyState === WebSocket.OPEN) {
                memberWs.send(JSON.stringify({
                  type: 'message_reaction_removed',
                  conversationId: conversation.id,
                  messageId,
                  userId: currentUser.id,
                  reaction
                }));
              }
            }
          }
        } else {
          // For direct messages, notify the other user
          const otherUserId = conversation.user1Id === currentUser.id 
            ? conversation.user2Id 
            : conversation.user1Id;
            
          if (otherUserId) {
            const otherUserWs = wsClients.get(otherUserId);
            if (otherUserWs && otherUserWs.readyState === WebSocket.OPEN) {
              otherUserWs.send(JSON.stringify({
                type: 'message_reaction_removed',
                conversationId: conversation.id,
                messageId,
                userId: currentUser.id,
                reaction
              }));
            }
          }
        }
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error removing reaction:', error);
      res.status(500).send('Server error');
    }
  });
  
  // Get all reactions for a message
  app.get('/api/messages/:messageId/reactions', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const messageId = parseInt(req.params.messageId);
      
      // Get the message to check if it exists
      const message = await storage.getMessageById(messageId);
      if (!message) {
        return res.status(404).send('Message not found');
      }
      
      const reactions = await storage.getMessageReactions(messageId);
      res.json(reactions);
    } catch (error) {
      console.error('Error getting reactions:', error);
      res.status(500).send('Server error');
    }
  });
  
  // Message editing endpoints
  
  // Edit a message
  app.put('/api/messages/:messageId', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const currentUser = req.user as User;
      const messageId = parseInt(req.params.messageId);
      
      // Get the message to check if it exists and if the user has access to it
      const message = await storage.getMessageById(messageId);
      if (!message) {
        return res.status(404).send('Message not found');
      }
      
      // Verify the user is the sender of the message
      if (message.senderId !== currentUser.id) {
        return res.status(403).send('You can only edit your own messages');
      }
      
      // Check if the message is deleted (can't edit deleted messages)
      if (message.isDeleted) {
        return res.status(400).send('Cannot edit a deleted message');
      }
      
      // Optional encryption details
      const encryptionDetails = req.body.isEncrypted ? {
        isEncrypted: true,
        encryptionType: req.body.encryptionType || 'sodium',
        nonce: req.body.nonce
      } : undefined;
      
      // Edit the message
      const updatedMessage = await storage.editMessage(
        messageId, 
        req.body.content,
        encryptionDetails
      );
      
      // Get sender info for the response
      const { password, ...senderWithoutPassword } = currentUser;
      
      // Get message edits history
      const edits = await storage.getMessageEdits(messageId);
      
      const messageWithUser = {
        ...updatedMessage,
        sender: senderWithoutPassword,
        edits
      };
      
      // Get the conversation to notify other users
      const conversation = await storage.getConversationById(message.conversationId);
      if (conversation) {
        // Notify other users that the message was edited
        if (conversation.isGroup) {
          // For group chats, notify all members except the current user
          const members = await storage.getGroupMembers(conversation.id);
          for (const member of members) {
            if (member.userId !== currentUser.id) {
              const memberWs = wsClients.get(member.userId);
              if (memberWs && memberWs.readyState === WebSocket.OPEN) {
                memberWs.send(JSON.stringify({
                  type: 'message_edited',
                  message: messageWithUser
                }));
              }
            }
          }
        } else {
          // For direct messages, notify the other user
          const otherUserId = conversation.user1Id === currentUser.id 
            ? conversation.user2Id 
            : conversation.user1Id;
            
          if (otherUserId) {
            const otherUserWs = wsClients.get(otherUserId);
            if (otherUserWs && otherUserWs.readyState === WebSocket.OPEN) {
              otherUserWs.send(JSON.stringify({
                type: 'message_edited',
                message: messageWithUser
              }));
            }
          }
        }
      }
      
      res.json(messageWithUser);
    } catch (error) {
      console.error('Error editing message:', error);
      res.status(500).send('Server error');
    }
  });
  
  // Get edit history for a message
  app.get('/api/messages/:messageId/edits', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const messageId = parseInt(req.params.messageId);
      
      // Get the message to check if it exists
      const message = await storage.getMessageById(messageId);
      if (!message) {
        return res.status(404).send('Message not found');
      }
      
      const edits = await storage.getMessageEdits(messageId);
      res.json(edits);
    } catch (error) {
      console.error('Error getting message edits:', error);
      res.status(500).send('Server error');
    }
  });
  
  // Delete a message
  app.delete('/api/messages/:messageId', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const currentUser = req.user as User;
      const messageId = parseInt(req.params.messageId);
      
      // Get the message to check if it exists and if the user has access to it
      const message = await storage.getMessageById(messageId);
      if (!message) {
        return res.status(404).send('Message not found');
      }
      
      // Verify the user is the sender of the message
      if (message.senderId !== currentUser.id) {
        return res.status(403).send('You can only delete your own messages');
      }
      
      // Delete the message
      await storage.deleteMessage(messageId);
      
      // Get the conversation to notify other users
      const conversation = await storage.getConversationById(message.conversationId);
      if (conversation) {
        // Notify other users that the message was deleted
        if (conversation.isGroup) {
          // For group chats, notify all members except the current user
          const members = await storage.getGroupMembers(conversation.id);
          for (const member of members) {
            if (member.userId !== currentUser.id) {
              const memberWs = wsClients.get(member.userId);
              if (memberWs && memberWs.readyState === WebSocket.OPEN) {
                memberWs.send(JSON.stringify({
                  type: 'message_deleted',
                  conversationId: conversation.id,
                  messageId
                }));
              }
            }
          }
        } else {
          // For direct messages, notify the other user
          const otherUserId = conversation.user1Id === currentUser.id 
            ? conversation.user2Id 
            : conversation.user1Id;
            
          if (otherUserId) {
            const otherUserWs = wsClients.get(otherUserId);
            if (otherUserWs && otherUserWs.readyState === WebSocket.OPEN) {
              otherUserWs.send(JSON.stringify({
                type: 'message_deleted',
                conversationId: conversation.id,
                messageId
              }));
            }
          }
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).send('Server error');
    }
  });
  
  // Forward a message
  app.post('/api/messages/:messageId/forward', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const currentUser = req.user as User;
      const messageId = parseInt(req.params.messageId);
      const { conversationId, receiverId } = req.body;
      
      if (!conversationId) {
        return res.status(400).send('ConversationId is required');
      }
      
      // Get the message to check if it exists
      const message = await storage.getMessageById(messageId);
      if (!message) {
        return res.status(404).send('Message not found');
      }
      
      // Get the target conversation to check if it exists and if the user has access to it
      const conversation = await storage.getConversationById(conversationId);
      if (!conversation) {
        return res.status(404).send('Conversation not found');
      }
      
      // Verify the user is part of the target conversation
      if (conversation.isGroup) {
        // For group chats, check if user is a member
        const members = await storage.getGroupMembers(conversation.id);
        const isMember = members.some(member => member.userId === currentUser.id);
        if (!isMember) {
          return res.status(403).send('You are not a member of this conversation');
        }
      } else {
        // For direct messages, check if user is part of the conversation
        if (conversation.user1Id !== currentUser.id && conversation.user2Id !== currentUser.id) {
          return res.status(403).send('Access denied');
        }
      }
      
      // Forward the message
      const forwardedMessage = await storage.forwardMessage(
        messageId,
        conversationId,
        currentUser.id,
        conversation.isGroup ? undefined : receiverId
      );
      
      // Get sender info for the response
      const { password, ...senderWithoutPassword } = currentUser;
      
      // Get the original message for the response
      const originalMessage = await storage.getMessageById(messageId);
      
      const messageWithUser = {
        ...forwardedMessage,
        sender: senderWithoutPassword,
        forwardedFrom: originalMessage
      };
      
      // Notify recipients of the new message
      if (conversation.isGroup) {
        // For group chats, notify all members except the current user
        const members = await storage.getGroupMembers(conversation.id);
        for (const member of members) {
          if (member.userId !== currentUser.id) {
            const memberWs = wsClients.get(member.userId);
            if (memberWs && memberWs.readyState === WebSocket.OPEN) {
              memberWs.send(JSON.stringify({
                type: 'new_message',
                message: messageWithUser
              }));
            }
          }
        }
      } else {
        // For direct messages, notify the other user
        const otherUserId = conversation.user1Id === currentUser.id 
          ? conversation.user2Id 
          : conversation.user1Id;
          
        if (otherUserId) {
          const otherUserWs = wsClients.get(otherUserId);
          if (otherUserWs && otherUserWs.readyState === WebSocket.OPEN) {
            otherUserWs.send(JSON.stringify({
              type: 'new_message',
              message: messageWithUser
            }));
          }
        }
      }
      
      res.status(201).json(messageWithUser);
    } catch (error) {
      console.error('Error forwarding message:', error);
      res.status(500).send('Server error');
    }
  });
  
  // Group conversation endpoints
  
  // Create a group conversation
  app.post('/api/group-conversations', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const currentUser = req.user as User;
      const { groupName, memberIds } = req.body;
      
      if (!groupName) {
        return res.status(400).send('Group name is required');
      }
      
      if (!Array.isArray(memberIds) || memberIds.length === 0) {
        return res.status(400).send('At least one member is required');
      }
      
      // Create the group conversation
      const conversation = await storage.createGroupConversation(
        { groupName, groupAvatar: req.body.groupAvatar },
        currentUser.id
      );
      
      // Add members to the group
      for (const memberId of memberIds) {
        if (memberId !== currentUser.id) { // Creator is already added
          await storage.addGroupMember({
            conversationId: conversation.id,
            userId: memberId,
            role: 'member',
            addedById: currentUser.id,
            isActive: true
          });
        }
      }
      
      // Get all members with user info
      const members = await storage.getGroupMembers(conversation.id);
      
      const conversationWithMembers = {
        ...conversation,
        members: members.map(m => m.user)
      };
      
      // Notify all members that they've been added to a group
      for (const member of members) {
        if (member.userId !== currentUser.id) {
          const memberWs = wsClients.get(member.userId);
          if (memberWs && memberWs.readyState === WebSocket.OPEN) {
            memberWs.send(JSON.stringify({
              type: 'group_created',
              conversation: conversationWithMembers
            }));
          }
        }
      }
      
      res.status(201).json(conversationWithMembers);
    } catch (error) {
      console.error('Error creating group conversation:', error);
      res.status(500).send('Server error');
    }
  });
  
  // Get group members
  app.get('/api/group-conversations/:id/members', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const currentUser = req.user as User;
      const conversationId = parseInt(req.params.id);
      
      // Get the conversation to check if it exists and is a group
      const conversation = await storage.getConversationById(conversationId);
      if (!conversation) {
        return res.status(404).send('Conversation not found');
      }
      
      if (!conversation.isGroup) {
        return res.status(400).send('This is not a group conversation');
      }
      
      // Verify the user is a member of the group
      const members = await storage.getGroupMembers(conversationId);
      const isMember = members.some(member => member.userId === currentUser.id);
      if (!isMember) {
        return res.status(403).send('You are not a member of this group');
      }
      
      res.json(members);
    } catch (error) {
      console.error('Error getting group members:', error);
      res.status(500).send('Server error');
    }
  });
  
  // Add a member to a group
  app.post('/api/group-conversations/:id/members', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const currentUser = req.user as User;
      const conversationId = parseInt(req.params.id);
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).send('UserId is required');
      }
      
      // Get the conversation to check if it exists and is a group
      const conversation = await storage.getConversationById(conversationId);
      if (!conversation) {
        return res.status(404).send('Conversation not found');
      }
      
      if (!conversation.isGroup) {
        return res.status(400).send('This is not a group conversation');
      }
      
      // Verify the current user is an admin of the group
      const members = await storage.getGroupMembers(conversationId);
      const currentMember = members.find(member => member.userId === currentUser.id);
      if (!currentMember || currentMember.role !== 'admin') {
        return res.status(403).send('Only admins can add members');
      }
      
      // Check if user is already a member
      const isAlreadyMember = members.some(member => member.userId === userId);
      if (isAlreadyMember) {
        return res.status(400).send('User is already a member of this group');
      }
      
      // Add the member
      const memberData = insertGroupMemberSchema.parse({
        conversationId,
        userId,
        role: 'member',
        addedById: currentUser.id,
        isActive: true
      });
      
      const member = await storage.addGroupMember(memberData);
      
      // Get user data
      const user = await storage.getUser(userId);
      if (user) {
        const { password, ...userWithoutPassword } = user;
        const memberWithUser = {
          ...member,
          user: userWithoutPassword
        };
        
        // Notify the added user
        const userWs = wsClients.get(userId);
        if (userWs && userWs.readyState === WebSocket.OPEN) {
          userWs.send(JSON.stringify({
            type: 'added_to_group',
            conversationId,
            conversation
          }));
        }
        
        // Notify other members
        for (const existingMember of members) {
          if (existingMember.userId !== currentUser.id) {
            const memberWs = wsClients.get(existingMember.userId);
            if (memberWs && memberWs.readyState === WebSocket.OPEN) {
              memberWs.send(JSON.stringify({
                type: 'member_added',
                conversationId,
                member: memberWithUser
              }));
            }
          }
        }
        
        res.status(201).json(memberWithUser);
      } else {
        res.status(404).send('User not found');
      }
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error('Error adding group member:', error);
      res.status(500).send('Server error');
    }
  });
  
  // Remove a member from a group
  app.delete('/api/group-conversations/:id/members/:userId', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const currentUser = req.user as User;
      const conversationId = parseInt(req.params.id);
      const userId = parseInt(req.params.userId);
      
      // Get the conversation to check if it exists and is a group
      const conversation = await storage.getConversationById(conversationId);
      if (!conversation) {
        return res.status(404).send('Conversation not found');
      }
      
      if (!conversation.isGroup) {
        return res.status(400).send('This is not a group conversation');
      }
      
      // Verify the current user is an admin of the group or is removing themselves
      const members = await storage.getGroupMembers(conversationId);
      const currentMember = members.find(member => member.userId === currentUser.id);
      
      if (userId !== currentUser.id) { // Not leaving the group
        if (!currentMember || currentMember.role !== 'admin') {
          return res.status(403).send('Only admins can remove members');
        }
      }
      
      // Check if user is a member
      const memberToRemove = members.find(member => member.userId === userId);
      if (!memberToRemove) {
        return res.status(404).send('User is not a member of this group');
      }
      
      // Remove the member
      await storage.removeGroupMember(conversationId, userId);
      
      // Notify the removed user
      const userWs = wsClients.get(userId);
      if (userWs && userWs.readyState === WebSocket.OPEN) {
        userWs.send(JSON.stringify({
          type: 'removed_from_group',
          conversationId
        }));
      }
      
      // Notify other members
      for (const member of members) {
        if (member.userId !== currentUser.id && member.userId !== userId) {
          const memberWs = wsClients.get(member.userId);
          if (memberWs && memberWs.readyState === WebSocket.OPEN) {
            memberWs.send(JSON.stringify({
              type: 'member_removed',
              conversationId,
              userId
            }));
          }
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing group member:', error);
      res.status(500).send('Server error');
    }
  });
  
  // Update group conversation details
  app.put('/api/group-conversations/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const currentUser = req.user as User;
      const conversationId = parseInt(req.params.id);
      const { groupName, groupAvatar } = req.body;
      
      // Get the conversation to check if it exists and is a group
      const conversation = await storage.getConversationById(conversationId);
      if (!conversation) {
        return res.status(404).send('Conversation not found');
      }
      
      if (!conversation.isGroup) {
        return res.status(400).send('This is not a group conversation');
      }
      
      // Verify the current user is an admin of the group
      const members = await storage.getGroupMembers(conversationId);
      const currentMember = members.find(member => member.userId === currentUser.id);
      if (!currentMember || currentMember.role !== 'admin') {
        return res.status(403).send('Only admins can update group details');
      }
      
      // Update the conversation
      const updatedConversation = await storage.updateGroupConversation(conversationId, {
        groupName: groupName || conversation.groupName,
        groupAvatar: groupAvatar !== undefined ? groupAvatar : conversation.groupAvatar,
        updatedAt: new Date()
      });
      
      if (!updatedConversation) {
        return res.status(404).send('Conversation not found');
      }
      
      // Notify all members
      for (const member of members) {
        if (member.userId !== currentUser.id) {
          const memberWs = wsClients.get(member.userId);
          if (memberWs && memberWs.readyState === WebSocket.OPEN) {
            memberWs.send(JSON.stringify({
              type: 'group_updated',
              conversation: updatedConversation
            }));
          }
        }
      }
      
      res.json(updatedConversation);
    } catch (error) {
      console.error('Error updating group conversation:', error);
      res.status(500).send('Server error');
    }
  });
  
  // File upload and attachments endpoints
  
  // Upload file and attach to a message
  app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const currentUser = req.user as User;
      
      if (!req.file) {
        return res.status(400).send('No file uploaded');
      }
      
      const { receiverId, conversationId: existingConvId } = req.body;
      
      if (!receiverId) {
        return res.status(400).send('ReceiverID is required');
      }
      
      // Get or create conversation
      const conversation = existingConvId 
        ? await storage.getConversationById(Number(existingConvId))
        : await storage.getOrCreateConversation(currentUser.id, Number(receiverId));
      
      if (!conversation) {
        return res.status(404).send('Conversation not found');
      }
      
      // Determine message type based on file type
      let messageType = 'file';
      const file = req.file;
      
      if (isImageFile(file.path)) {
        messageType = 'image';
      } else if (isVideoFile(file.path)) {
        messageType = 'video';
      } else if (isAudioFile(file.path)) {
        messageType = 'audio';
      }
      
      // Generate thumbnail for images if possible
      const thumbnailPath = await generateThumbnail(file.path);
      
      // Create the message first
      const messageData = insertMessageSchema.parse({
        conversationId: conversation.id,
        senderId: currentUser.id,
        receiverId: Number(receiverId),
        content: req.body.content || null, // Optional text to accompany the file
        messageType,
        isEncrypted: false, // Files are not encrypted in this implementation
        timestamp: new Date(),
        hasAttachment: true
      });
      
      const message = await storage.createMessage(messageData);
      
      // Create the attachment record
      const attachmentData = insertAttachmentSchema.parse({
        messageId: message.id,
        filename: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        filePath: getRelativePath(file.path),
        thumbnailPath: thumbnailPath ? getRelativePath(thumbnailPath) : null,
        isEncrypted: false,
        nonce: null
      });
      
      const attachment = await storage.createAttachment(attachmentData);
      
      // Get sender info
      const sender = await storage.getUser(currentUser.id);
      if (!sender) {
        return res.status(404).send('Sender not found');
      }
      
      const { password, ...senderWithoutPassword } = sender;
      
      // Create response with URLs
      const attachmentWithUrl: AttachmentWithThumbnail = {
        ...attachment,
        downloadUrl: attachment.filePath,
        thumbnailUrl: attachment.thumbnailPath || undefined
      };
      
      const messageWithAttachment = {
        ...message,
        sender: senderWithoutPassword,
        attachments: [attachmentWithUrl]
      };
      
      // Notify the receiver via WebSocket
      const receiverWs = wsClients.get(Number(receiverId));
      if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
        receiverWs.send(JSON.stringify({
          type: 'new_message',
          message: messageWithAttachment
        }));
      }
      
      res.status(201).json(messageWithAttachment);
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).send('Server error');
    }
  });
  
  // Get attachments for a message
  app.get('/api/messages/:messageId/attachments', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const messageId = parseInt(req.params.messageId);
      const attachments = await storage.getAttachmentsByMessageId(messageId);
      
      // Add URLs to attachments
      const attachmentsWithUrls: AttachmentWithThumbnail[] = attachments.map(attachment => ({
        ...attachment,
        downloadUrl: attachment.filePath,
        thumbnailUrl: attachment.thumbnailPath || undefined
      }));
      
      res.json(attachmentsWithUrls);
    } catch (error) {
      console.error('Error getting attachments:', error);
      res.status(500).send('Server error');
    }
  });
  
  // Get a specific attachment
  app.get('/api/attachments/:id', async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send('Unauthorized');
    
    try {
      const attachmentId = parseInt(req.params.id);
      const attachment = await storage.getAttachment(attachmentId);
      
      if (!attachment) {
        return res.status(404).send('Attachment not found');
      }
      
      const attachmentWithUrl: AttachmentWithThumbnail = {
        ...attachment,
        downloadUrl: attachment.filePath,
        thumbnailUrl: attachment.thumbnailPath || undefined
      };
      
      res.json(attachmentWithUrl);
    } catch (error) {
      console.error('Error getting attachment:', error);
      res.status(500).send('Server error');
    }
  });

  return httpServer;
}
