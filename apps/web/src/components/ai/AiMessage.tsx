'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Code2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { AiChart } from './AiChart';

interface MessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  generated_sql?: string | null;
  query_result?: {
    rows: Record<string, unknown>[];
    chartType: string;
    chartConfig: Record<string, unknown>;
  } | null;
}

interface AiMessageProps {
  message: MessageData;
}

export function AiMessage({ message }: AiMessageProps) {
  const [sqlExpanded, setSqlExpanded] = useState(false);
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[70%] rounded-2xl rounded-tr-sm bg-primary-blue text-white px-4 py-2.5">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-3">
        {/* Text Response */}
        <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-4 py-3">
          <div className="prose prose-sm max-w-none text-gray-800">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        </div>

        {/* SQL Block (collapsible) */}
        {message.generated_sql && (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setSqlExpanded(!sqlExpanded)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-sm text-gray-600"
            >
              {sqlExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Code2 className="h-4 w-4" />
              <span>SQL Query</span>
            </button>
            {sqlExpanded && (
              <div className="border-t border-gray-200">
                <SyntaxHighlighter
                  language="sql"
                  style={oneLight}
                  customStyle={{
                    margin: 0,
                    padding: '12px 16px',
                    fontSize: '13px',
                    background: '#fafafa',
                  }}
                >
                  {message.generated_sql}
                </SyntaxHighlighter>
              </div>
            )}
          </div>
        )}

        {/* Chart / Table */}
        {message.query_result && message.query_result.rows.length > 0 && (
          <div className="rounded-lg border border-gray-200 overflow-hidden bg-white p-3">
            <AiChart
              data={message.query_result.rows}
              chartType={message.query_result.chartType}
              chartConfig={message.query_result.chartConfig}
            />
          </div>
        )}
      </div>
    </div>
  );
}
