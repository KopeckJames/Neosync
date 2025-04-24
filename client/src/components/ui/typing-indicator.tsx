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
    <div className="flex items-end gap-2 max-w-[80%] my-1 animate-fade-in">
      <UserAvatar user={contact} size="sm" />
      <div className="bg-secondary px-4 py-3 rounded-lg rounded-bl-none flex items-center gap-1.5">
        <div className="w-2 h-2 bg-primary/50 rounded-full animate-typing-dot" />
        <div className="w-2 h-2 bg-primary/60 rounded-full animate-typing-dot" style={{ animationDelay: "0.2s" }} />
        <div className="w-2 h-2 bg-primary/70 rounded-full animate-typing-dot" style={{ animationDelay: "0.4s" }} />
      </div>
    </div>
  );
}
