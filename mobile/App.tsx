import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Import screens
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import ConversationScreen from './src/screens/ConversationScreen';
import ProfileScreen from './src/screens/ProfileScreen';

// Create the query client
const queryClient = new QueryClient();

// Define the root stack parameter list
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  Conversation: { conversationId: number; title: string };
  Profile: { userId: number };
};

// Create the stack navigator
const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NavigationContainer>
            <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen 
                name="Conversation" 
                component={ConversationScreen}
                options={({ route }) => ({ 
                  headerShown: true,
                  title: route.params.title 
                })} 
              />
              <Stack.Screen 
                name="Profile" 
                component={ProfileScreen}
                options={{ headerShown: true, title: 'Profile' }} 
              />
            </Stack.Navigator>
          </NavigationContainer>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}