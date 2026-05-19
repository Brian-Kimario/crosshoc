import * as React from "react";
import { cn } from "@/lib/utils";

export interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number; // pixel size, default 32
  className?: string;
}

const AVATAR_COLORS = [
  "#134E4A",
  "#3B0764",
  "#1E3A5F",
  "#78350F",
  "#4C1D95",
  "#065F46",
  "#1E1B4B",
  "#7C2D12",
];

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function UserAvatar({
  name,
  avatarUrl,
  size = 32,
  className,
}: UserAvatarProps) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: size, height: size }}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }

  const initials = getInitials(name);
  const background = getAvatarColor(name);
  const fontSize = Math.floor(size * 0.38);

  return (
    <div
      style={{ width: size, height: size, background, fontSize }}
      className={cn(
        "rounded-full flex items-center justify-center text-white font-medium select-none",
        className
      )}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
