'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { useOrgStore } from '@/stores/org-store';
import { AiChat } from '@/components/ai/AiChat';

interface Conversation {
  id: string;
  title: string | null;
  message_count: number;
  updated_at: string;
}

export default function AiPage() {
  const t = useTranslations('ai');
  const { currentOrgId } = useOrgStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      if (!currentOrgId) return;
      const res = await apiClient<{ data: Conversation[] }>(
        `/organizations/${currentOrgId}/ai/conversations`,
      );
      setConversations(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleNewConversation = async () => {
    try {
      if (!currentOrgId) return;
      const res = await apiClient<{ data: Conversation }>(
        `/organizations/${currentOrgId}/ai/conversations`,
        { method: 'POST' },
      );
      setConversations((prev) => [res.data, ...prev]);
      setActiveConvId(res.data.id);
    } catch {
      // ignore
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (!currentOrgId) return;
      await apiClient(`/organizations/${currentOrgId}/ai/conversations/${id}`, {
        method: 'DELETE',
      });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) setActiveConvId(null);
    } catch {
      // ignore
    }
  };

  const handleConversationUpdate = () => {
    fetchConversations();
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* Sidebar */}
      <div className="w-72 flex-shrink-0 flex flex-col bg-white rounded-lg border border-gray-200">
        <div className="p-3 border-b border-gray-200">
          <Button onClick={handleNewConversation} className="w-full gap-2" size="sm">
            <Plus className="h-4 w-4" />
            {t('newConversation')}
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-gray-400">{t('loading')}</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">{t('noConversations')}</div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-gray-100 hover:bg-gray-50 transition-colors group ${
                  activeConvId === conv.id ? 'bg-blue-50 border-l-2 border-l-primary-blue' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <MessageSquare className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">
                        {conv.title || t('untitled')}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(conv.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white rounded-lg border border-gray-200 min-w-0">
        {activeConvId ? (
          <AiChat conversationId={activeConvId} onConversationUpdate={handleConversationUpdate} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-500">{t('welcomeTitle')}</h3>
              <p className="text-sm text-gray-400 mt-1 max-w-md">{t('welcomeSubtitle')}</p>
              <Button onClick={handleNewConversation} className="mt-4 gap-2" variant="outline">
                <Plus className="h-4 w-4" />
                {t('startConversation')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
