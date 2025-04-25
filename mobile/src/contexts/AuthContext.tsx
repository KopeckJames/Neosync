import React, { createContext, ReactNode, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { useMutation, useQuery, UseQueryResult } from '@tanstack/react-query';
import { API_URL } from '../config';

// Define the User type (simplified version of what's in shared/schema.ts)
interface User {
  id: number;
  username: string;
  isOnline: boolean;
  lastSeen: string;
  avatarColor: string;
}

// Define the types for the context
type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

// Create the context
export const AuthContext = createContext<AuthContextType | null>(null);

// Create the provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  // Load token from AsyncStorage on mount
  useEffect(() => {
    const loadToken = async () => {
      try {
        const savedToken = await AsyncStorage.getItem('auth_token');
        if (savedToken) {
          setToken(savedToken);
        }
      } catch (error) {
        console.error('Failed to load authentication token:', error);
      }
    };
    
    loadToken();
  }, []);

  // Query for getting user information
  const {
    data: user,
    error,
    isLoading,
    refetch
  }: UseQueryResult<User, Error> = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      if (!token) return null;
      
      const response = await fetch(`${API_URL}/api/user`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Client-Type': 'mobile'  // Indicate this is a mobile client
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      
      const data = await response.json();
      
      // If we get a new token, update it
      if (data.token) {
        await AsyncStorage.setItem('auth_token', data.token);
        setToken(data.token);
      }
      
      return data;
    },
    enabled: !!token,
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Type': 'mobile'  // Indicate this is a mobile client
        },
        body: JSON.stringify(credentials)
      });
      
      if (!response.ok) {
        throw new Error('Login failed. Please check your credentials.');
      }
      
      const data = await response.json();
      return data;
    },
    onSuccess: async (data) => {
      if (!data.token) {
        throw new Error('No authentication token received from server');
      }
      await AsyncStorage.setItem('auth_token', data.token);
      setToken(data.token);
      refetch();
    },
    onError: (error: Error) => {
      Alert.alert('Login Error', error.message);
    }
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const response = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Type': 'mobile'  // Indicate this is a mobile client
        },
        body: JSON.stringify(credentials)
      });
      
      if (!response.ok) {
        throw new Error('Registration failed. Username may already be taken.');
      }
      
      const data = await response.json();
      return data;
    },
    onSuccess: async (data) => {
      if (!data.token) {
        throw new Error('No authentication token received from server');
      }
      await AsyncStorage.setItem('auth_token', data.token);
      setToken(data.token);
      refetch();
    },
    onError: (error: Error) => {
      Alert.alert('Registration Error', error.message);
    }
  });

  // Logout function
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_URL}/api/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Client-Type': 'mobile'  // Indicate this is a mobile client
        }
      });
      
      if (!response.ok) {
        throw new Error('Logout failed');
      }
    },
    onSuccess: async () => {
      await AsyncStorage.removeItem('auth_token');
      setToken(null);
    },
    onError: (error: Error) => {
      Alert.alert('Logout Error', error.message);
    }
  });
  
  // Provide the login, register, and logout functions
  const login = async (username: string, password: string) => {
    await loginMutation.mutateAsync({ username, password });
  };
  
  const register = async (username: string, password: string) => {
    await registerMutation.mutateAsync({ username, password });
  };
  
  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Create a hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}