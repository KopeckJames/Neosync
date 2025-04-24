import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertContactSchema, insertMessageSchema, User } from "@shared/schema";
import { ZodError } from "zod";

// WebSocket clients mapping (userId -> WebSocket)
const wsClients = new Map<number, WebSocket>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Sets up auth routes (/api/register, /api/login, /api/logout, /api/user)
  setupAuth(app);

  const httpServer = createServer(app);
  
  // Set up WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws, req) => {
    // Get session ID from cookies
    let userId: number | null = null;
    
    // Handle messages from client
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Handle authentication
        if (message.type === 'authenticate' && message.userId) {
          userId = message.userId;
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
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });
    
    // Handle disconnection
    ws.on('close', async () => {
      if (userId) {
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
  
  // Send a message
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

  return httpServer;
}
