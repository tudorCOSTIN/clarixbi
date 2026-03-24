'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Send, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { AiMessage } from './AiMessage';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  generated_sql?: string | null;
  query_result?: {
    rows: Record<string, unknown>[];
    chartType: string;
    chartConfig: Record<string, unknown>;
  } | null;
  created_at: string;
}

interface SendMessageResponse {
  response: string;
  sql: string | null;
  data: Record<string, unknown>[] | null;
  chartType: string;
  chartConfig: Record<string, unknown>;
}

interface AiChatProps {
  conversationId: string;
  onConversationUpdate?: () => void;
}

export function AiChat({ conversationId, onConversationUpdate }: AiChatProps) {
  const t = useTranslations('ai');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [rateLimited, setRateLimited] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const fetchMessages = async () => {
      setLoadingMessages(true);
      setRateLimited(false);
      try {
        const orgId = getOrgId();
        if (!orgId) return;
        const res = await apiClient<{
          data: { messages: Message[] };
        }>(`/organizations/${orgId}/ai/conversations/${conversationId}`);
        setMessages(res.data.messages || []);
      } catch {
        // ignore
      } finally {
        setLoadingMessages(false);
      }
    };
    fetchMessages();
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending) return;

    const orgId = getOrgId();
    if (!orgId) return;

    // Add user message optimistically
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await apiClient<{ data: SendMessageResponse }>(
        `/organizations/${orgId}/ai/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ content }),
        },
      );

      const assistantMsg: Message = {
        id: `resp-${Date.now()}`,
        role: 'assistant',
        content: res.data.response,
        generated_sql: res.data.sql,
        query_result: res.data.data
          ? {
              rows: res.data.data,
              chartType: res.data.chartType,
              chartConfig: res.data.chartConfig,
            }
          : null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      onConversationUpdate?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('errorGeneric');

      // Detect rate limit error
      if (
        errorMessage.includes('AI_RATE_LIMIT') ||
        errorMessage.includes('429') ||
        errorMessage.includes('limita')
      ) {
        setRateLimited(true);
      }

      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: errorMessage,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Rate limit overlay */}
      {rateLimited && (
        <div className="absolute inset-0 bg-white/90 z-10 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900">Limita atinsa</h3>
            <p className="text-sm text-gray-500 mt-2">
              Ai atins limita de interogari AI pentru luna aceasta.
            </p>
            <Link
              href="/settings/billing"
              className="inline-block mt-4 px-4 py-2 bg-primary-blue text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
            >
              Upgradeaza planul
            </Link>
            <button
              onClick={() => setRateLimited(false)}
              className="block mx-auto mt-2 text-xs text-gray-500 hover:text-gray-600"
            >
              Inchide
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            {t('emptyChat')}
          </div>
        ) : (
          messages.map((msg) => <AiMessage key={msg.id} message={msg} />)
        )}
        {sending && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('analyzing')}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('inputPlaceholder')}
            aria-label={t('inputPlaceholder')}
            disabled={sending}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed max-h-[120px]"
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            size="icon"
            className="h-10 w-10 flex-shrink-0"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function getOrgId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('clarixbi-org-store');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.state?.currentOrgId || null;
    }
  } catch {
    // ignore
  }
  return null;
}
