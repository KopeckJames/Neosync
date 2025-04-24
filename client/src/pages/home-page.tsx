import { ChatLayout } from "@/components/layouts/chat-layout";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

export default function HomePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Redirect to auth if no user
  useEffect(() => {
    if (user === null) {
      setLocation("/auth");
    }
  }, [user, setLocation]);
  
  if (!user) return null;

  return <ChatLayout />;
}
