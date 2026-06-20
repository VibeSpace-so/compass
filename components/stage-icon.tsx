"use client";

import {
  Lightbulb,
  FileText,
  Hammer,
  GitBranch,
  Rocket,
  Globe,
  Sparkles,
  Check,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Lightbulb,
  FileText,
  Hammer,
  GitBranch,
  Rocket,
  Globe,
  Sparkles,
};

interface StageIconProps {
  name: string;
  completed?: boolean;
  className?: string;
}

export default function StageIcon({ name, completed, className }: StageIconProps) {
  if (completed) {
    return <Check className={className} />;
  }
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon className={className} />;
}
