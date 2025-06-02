
"use client";

import type React from 'react';
import { createContext, useContext, type ReactNode } from 'react';

interface ChatContextType {
  focusChatInput: (prefillText?: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};

interface ChatProviderProps {
  children: ReactNode;
  focusChatInput: (prefillText?: string) => void;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children, focusChatInput }) => {
  return (
    <ChatContext.Provider value={{ focusChatInput }}>
      {children}
    </ChatContext.Provider>
  );
};
