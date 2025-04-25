import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual, createHmac } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, insertUserSchema } from "@shared/schema";
import { ZodError } from "zod";
import { generateUserKeys } from "./encryption";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Generate random avatar colors
function getRandomColor() {
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-yellow-500",
    "bg-indigo-500",
    "bg-red-500",
    "bg-orange-500",
    "bg-teal-500",
    "bg-cyan-500"
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Generate a JWT token for mobile clients
function generateToken(userId: number): string {
  const tokenData = { 
    userId, 
    timestamp: Date.now() 
  };
  const payload = Buffer.from(JSON.stringify(tokenData)).toString('base64');
  
  // Use the session secret to sign the token
  const sessionSecret = process.env.SESSION_SECRET || "signal-clone-dev-secret";
  const signature = createHmac('sha256', sessionSecret)
    .update(payload)
    .digest('base64');
  
  return `${payload}.${signature}`;
}

// Validate a JWT token from mobile clients
async function validateToken(token: string): Promise<SelectUser | null> {
  try {
    const [payload, signature] = token.split('.');
    const sessionSecret = process.env.SESSION_SECRET || "signal-clone-dev-secret";
    
    // Verify the signature
    const expectedSignature = createHmac('sha256', sessionSecret)
      .update(payload)
      .digest('base64');
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    // Parse the payload
    const tokenData = JSON.parse(Buffer.from(payload, 'base64').toString());
    
    // Check if token is expired (7 days)
    const tokenAge = Date.now() - tokenData.timestamp;
    if (tokenAge > 1000 * 60 * 60 * 24 * 7) {
      return null;
    }
    
    // Retrieve the user
    const user = await storage.getUser(tokenData.userId);
    return user || null;
  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
}

export function setupAuth(app: Express) {
  // Use the session secret from environment variable or use a default for development
  const sessionSecret = process.env.SESSION_SECRET || "signal-clone-dev-secret";
  
  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax"
    }
  };
  
  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Add middleware to handle token authentication for mobile clients
  // This middleware must be added AFTER passport initialization
  app.use(async (req: Request, res, next) => {
    // Skip if already authenticated via session
    if (req.isAuthenticated && req.isAuthenticated()) {
      return next();
    }
    
    // Check for token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const user = await validateToken(token);
      
      if (user) {
        // Set the user in the request
        req.user = user;
        // Update last seen for mobile users too
        await storage.updateLastSeen(user.id);
      }
    }
    
    next();
  });

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          // Update user status to online
          await storage.updateUserStatus(user.id, true);
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      // Update last seen
      if (user) {
        await storage.updateLastSeen(user.id);
      }
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Validate request body
      const userData = insertUserSchema.parse({
        ...req.body,
        avatarColor: getRandomColor(),
      });
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }

      // Create new user with hashed password
      const user = await storage.createUser({
        ...userData,
        password: await hashPassword(userData.password),
      });

      // Generate encryption keys for the user
      try {
        const keyBundle = await generateUserKeys(user.id);
        await storage.storeUserKey(user.id, keyBundle.publicKey);
        console.log(`Generated and stored encryption keys for user ${user.id}`);
      } catch (error) {
        console.error('Error generating encryption keys:', error);
        // Continue with login even if key generation fails
      }

      // Log user in
      req.login(user, (err) => {
        if (err) return next(err);
        
        // Return user without password
        const { password, ...userWithoutPassword } = user;
        
        // Check if the client is mobile
        const isMobileClient = req.get('X-Client-Type') === 'mobile';
        
        if (isMobileClient) {
          // Generate a token for mobile clients
          const token = generateToken(user.id);
          return res.status(201).json({
            ...userWithoutPassword,
            token
          });
        }
        
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).send("Invalid username or password");
      
      req.login(user, (err) => {
        if (err) return next(err);
        
        // Return user without password
        const { password, ...userWithoutPassword } = user;
        
        // Check if the client is mobile (has a special header)
        const isMobileClient = req.get('X-Client-Type') === 'mobile';
        
        if (isMobileClient) {
          // Generate a token for mobile clients
          const token = generateToken(user.id);
          return res.status(200).json({
            ...userWithoutPassword,
            token
          });
        }
        
        // For web clients, just return the user without a token
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", async (req, res, next) => {
    try {
      // Update user status to offline before logging out
      if (req.user) {
        await storage.updateUserStatus((req.user as SelectUser).id, false);
      }
      
      // Check if mobile client
      const isMobileClient = req.get('X-Client-Type') === 'mobile';
      
      if (isMobileClient) {
        // For mobile clients, we don't need to do anything with the session
        // The client will delete their token
        return res.sendStatus(200);
      }
      
      // For web clients, use session logout
      req.logout((err) => {
        if (err) return next(err);
        res.sendStatus(200);
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/user", (req, res) => {
    // For both session-based and token-based auth, req.user should be set
    if (!req.user) return res.sendStatus(401);
    
    // Return user without password
    const { password, ...userWithoutPassword } = req.user as SelectUser;
    
    // Include token if mobile client
    const isMobileClient = req.get('X-Client-Type') === 'mobile';
    if (isMobileClient) {
      const token = generateToken(userWithoutPassword.id);
      return res.json({
        ...userWithoutPassword,
        token
      });
    }
    
    res.json(userWithoutPassword);
  });
}
