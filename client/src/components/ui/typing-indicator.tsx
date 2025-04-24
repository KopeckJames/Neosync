import { UserAvatar } from "@/components/ui/user-avatar";

interface TypingIndicatorProps {
  contact: {
    id: number;
    displayName: string;
    avatarColor?: string | null;
  };
}

export function TypingIndicator({ contact }: TypingIndicatorProps) {
  return (
    <div className="flex items-end gap-2 max-w-[80%]">
      <UserAvatar user={contact} size="sm" />
      <div className="bg-secondary p-4 rounded-lg rounded-bl-none flex items-center gap-1">
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" style={{ animationDelay: "0.2s" }} />
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" style={{ animationDelay: "0.4s" }} />
      </div>
    </div>
  );
}
