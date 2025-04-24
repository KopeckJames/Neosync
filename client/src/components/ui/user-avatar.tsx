import { User } from "@shared/schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  user: {
    id?: number;
    displayName: string;
    avatarColor?: string | null;
  };
  size?: "sm" | "md" | "lg" | "xl";
  status?: "online" | "offline" | "none";
}

export function UserAvatar({ user, size = "md", status = "none" }: UserAvatarProps) {
  const initials = getInitials(user.displayName);
  const avatarColor = user.avatarColor || "bg-primary";
  
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
    xl: "h-24 w-24 text-2xl"
  };
  
  return (
    <div className="relative">
      <Avatar className={cn(sizeClasses[size])}>
        <AvatarFallback className={avatarColor}>
          {initials}
        </AvatarFallback>
      </Avatar>
      
      {status !== "none" && (
        <span 
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-gray-900 h-3 w-3",
            status === "online" ? "bg-green-500" : "bg-gray-400"
          )} 
        />
      )}
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.split(" ");
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
