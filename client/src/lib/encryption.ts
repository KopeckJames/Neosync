import { apiRequest } from '@/lib/queryClient';
import * as sodium from 'libsodium-wrappers';

// Types for our simplified encryption
export interface KeyBundle {
  userId: number;
  publicKey: string; // base64 encoded public key
}

export interface EncryptedMessage {
  content: string; // base64 encoded encrypted message
  nonce: string; // base64 encoded nonce
}

// Initialize sodium library
let sodiumInitialized = false;
async function initSodium() {
  if (!sodiumInitialized) {
    await sodium.ready;
    sodiumInitialized = true;
  }
}

// In-memory store for keys
class KeyStore {
  private myKeyPair: sodium.KeyPair | null = null;
  private contactPublicKeys: Map<number, Uint8Array> = new Map();

  // Get my key pair, generating if needed
  async getOrCreateMyKeyPair(): Promise<sodium.KeyPair> {
    await initSodium();
    
    if (!this.myKeyPair) {
      this.myKeyPair = sodium.crypto_box_keypair();
    }
    
    return this.myKeyPair;
  }
  
  // Store a contact's public key
  storeContactPublicKey(userId: number, publicKey: Uint8Array): void {
    this.contactPublicKeys.set(userId, publicKey);
  }
  
  // Get a contact's public key
  getContactPublicKey(userId: number): Uint8Array | undefined {
    return this.contactPublicKeys.get(userId);
  }
}

// Singleton key store
const keyStore = new KeyStore();

// Generate encryption keys for the current user
export async function generateUserKeys(userId: number): Promise<KeyBundle> {
  await initSodium();
  
  // Generate key pair
  const keyPair = await keyStore.getOrCreateMyKeyPair();
  
  // Create key bundle
  const keyBundle: KeyBundle = {
    userId,
    publicKey: arrayBufferToBase64(keyPair.publicKey)
  };
  
  // Send public key to server
  try {
    await apiRequest('POST', '/api/keys', keyBundle);
  } catch (error) {
    console.error('Failed to upload keys:', error);
  }
  
  return keyBundle;
}

// Store a contact's public key for future encryption
export async function storeContactKey(userId: number, publicKeyBase64: string): Promise<void> {
  await initSodium();
  
  const publicKey = base64ToUint8Array(publicKeyBase64);
  keyStore.storeContactPublicKey(userId, publicKey);
}

// Encrypt a message for a recipient
export async function encryptMessage(recipientId: number, message: string): Promise<EncryptedMessage> {
  await initSodium();
  
  // Get recipient's public key
  const recipientPublicKey = keyStore.getContactPublicKey(recipientId);
  if (!recipientPublicKey) {
    throw new Error('Recipient public key not found. Call storeContactKey first.');
  }
  
  // Get my key pair
  const myKeyPair = await keyStore.getOrCreateMyKeyPair();
  
  // Create nonce
  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
  
  // Encrypt message
  const messageData = new TextEncoder().encode(message);
  const encryptedMessage = sodium.crypto_box_easy(
    messageData,
    nonce,
    recipientPublicKey,
    myKeyPair.privateKey
  );
  
  return {
    content: arrayBufferToBase64(encryptedMessage),
    nonce: arrayBufferToBase64(nonce)
  };
}

// Decrypt a message from a sender
export async function decryptMessage(
  senderId: number, 
  encryptedMessage: EncryptedMessage
): Promise<string> {
  await initSodium();
  
  // Get sender's public key
  const senderPublicKey = keyStore.getContactPublicKey(senderId);
  if (!senderPublicKey) {
    throw new Error('Sender public key not found. Call storeContactKey first.');
  }
  
  // Get my key pair
  const myKeyPair = await keyStore.getOrCreateMyKeyPair();
  
  // Decrypt message
  const messageData = base64ToUint8Array(encryptedMessage.content);
  const nonce = base64ToUint8Array(encryptedMessage.nonce);
  
  try {
    const decryptedMessage = sodium.crypto_box_open_easy(
      messageData,
      nonce,
      senderPublicKey,
      myKeyPair.privateKey
    );
    
    return new TextDecoder().decode(decryptedMessage);
  } catch (error) {
    console.error('Failed to decrypt message:', error);
    throw new Error('Failed to decrypt message');
  }
}

// Helper functions for base64 conversion
export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  return base64ToUint8Array(base64).buffer;
}