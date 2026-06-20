"use client";

import { useState, useRef, useEffect } from "react";
import { SendHorizontal, KeyRound, Lock } from "lucide-react";
import { ChatMessage, Project } from "@/lib/types";
import { getStage } from "@/lib/stages";
import { generateId } from "@/lib/storage";

interface ChatPanelProps {
  project: Project;
  messages: ChatMessage[];
  onSendMessage: (message: ChatMessage) => void;
  isEnabled: boolean;
  onSetupKeys: () => void;
}

function getSystemGreeting(project: Project): string {
  const stage = getStage(project.currentStage);
  if (!stage) return "How can I help with your project?";
  return `You're in the ${stage.label} stage. ${stage.nextAction} What would you like to work on?`;
}

function generateGuidanceResponse(input: string, project: Project): string {
  const stage = getStage(project.currentStage);
  if (!stage) return "Let me know what you'd like to work on.";

  const lower = input.toLowerCase();

  if (lower.includes("next") || lower.includes("what should")) {
    return `Here's your next move: ${stage.nextAction}\n\nRecommended tools for this stage: ${stage.tools.join(", ")}.`;
  }

  if (lower.includes("tool") || lower.includes("which")) {
    return `For the ${stage.label} stage, I'd recommend: ${stage.tools.join(", ")}.\n\nEach has tradeoffs — pick the one that matches your comfort level. You can select one in the Guidance tab.`;
  }

  if (lower.includes("debt") || lower.includes("risk")) {
    return `${stage.debtNote}\n\nRisk level: ${stage.risk} | Complexity: ${stage.complexity}.`;
  }

  if (lower.includes("resource") || lower.includes("learn") || lower.includes("tutorial")) {
    const links = stage.links.map((l) => `- ${l.label}: ${l.url}`).join("\n");
    return `Here are some resources for the ${stage.label} stage:\n\n${links}`;
  }

  if (lower.includes("advance") || lower.includes("move on") || lower.includes("next stage")) {
    return `Before advancing, make sure you've completed the key action for this stage: "${stage.nextAction}"\n\nYou can advance from the Guidance tab when you're ready.`;
  }

  return `You're currently in the ${stage.label} stage (${stage.description.toLowerCase()})\n\nYour next move: ${stage.nextAction}\n\nFeel free to ask about tools, debt, resources, or what comes next.`;
}

export default function ChatPanel({
  project,
  messages,
  onSendMessage,
  isEnabled,
  onSetupKeys,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!input.trim() || !isEnabled) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    onSendMessage(userMessage);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const response = generateGuidanceResponse(userMessage.content, project);
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: response,
        timestamp: new Date().toISOString(),
      };
      onSendMessage(assistantMessage);
      setIsTyping(false);
    }, 600 + Math.random() * 400);
  }

  if (!isEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-12 h-12 rounded-full border border-[var(--accent-26)] flex items-center justify-center mb-4">
          <Lock className="w-5 h-5 text-[var(--accent-44)]" />
        </div>
        <h3 className="text-sm font-medium text-[var(--accent)] mb-2">
          Chat requires API keys
        </h3>
        <p className="text-xs text-[var(--accent-88)] text-center max-w-sm mb-5 leading-relaxed">
          Set up at least one AI provider to enable the guided chat experience.
          Your keys stay in your browser — they never leave this device.
        </p>
        <button
          onClick={onSetupKeys}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded text-xs bg-[var(--accent)] text-black font-medium hover:opacity-80 transition-opacity"
        >
          <KeyRound className="w-3.5 h-3.5" />
          Set up API keys
        </button>
      </div>
    );
  }

  const greeting = getSystemGreeting(project);

  return (
    <div className="flex flex-col h-[500px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4 pr-1">
        {/* System greeting */}
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-7 h-7 rounded bg-[var(--accent-10)] border border-[var(--accent-26)] flex items-center justify-center">
            <span className="text-xs text-[var(--accent)]">C</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-[var(--accent-44)] mb-1">Compass</div>
            <div className="text-sm text-[var(--accent-cc)] leading-relaxed">
              {greeting}
            </div>
          </div>
        </div>

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center ${
                msg.role === "user"
                  ? "bg-[var(--accent)] text-black"
                  : "bg-[var(--accent-10)] border border-[var(--accent-26)]"
              }`}
            >
              <span className="text-xs">
                {msg.role === "user" ? "Y" : "C"}
              </span>
            </div>
            <div
              className={`flex-1 min-w-0 ${msg.role === "user" ? "text-right" : ""}`}
            >
              <div className="text-[10px] text-[var(--accent-44)] mb-1">
                {msg.role === "user" ? "You" : "Compass"}
              </div>
              <div
                className={`text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "text-[var(--accent)] inline-block text-left bg-[var(--accent-10)] rounded px-3 py-2 border border-[var(--accent-26)]"
                    : "text-[var(--accent-cc)]"
                }`}
              >
                {msg.content}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded bg-[var(--accent-10)] border border-[var(--accent-26)] flex items-center justify-center">
              <span className="text-xs text-[var(--accent)]">C</span>
            </div>
            <div className="flex-1">
              <div className="text-[10px] text-[var(--accent-44)] mb-1">Compass</div>
              <div className="text-sm text-[var(--accent-44)] animate-pulse">
                Thinking...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[var(--accent-26)] pt-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about your next step, tools, or debt..."
            className="flex-1 bg-black border border-[var(--accent-26)] rounded px-3 py-2.5 text-sm text-[var(--accent)] placeholder:text-[var(--accent-44)] focus:border-[var(--accent)] outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-3 py-2.5 rounded bg-[var(--accent)] text-black hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <SendHorizontal className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-[var(--accent-44)] mt-1.5">
          Chat responses are generated locally based on your project stage and Compass data.
        </p>
      </div>
    </div>
  );
}
