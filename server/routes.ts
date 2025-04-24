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
  User, 
  Attachment, 
  AttachmentWithThumbnail 
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
