/**
 * DocumentPage Component
 *
 * Displays project documentation from actual markdown files.
 * Uses react-markdown for rendering with Tailwind typography styles.
 * Includes syntax highlighting for code blocks via react-syntax-highlighter.
 * Themed with U.S. Soccer Federation 2025/2026 branding (light theme).
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Import actual markdown files from project root
import readmeContent from '@docs/README.md?raw';
import prdContent from '@docs/prd-parking (1).md?raw';
import pricingContent from '@docs/PRICING_LOGIC.md?raw';

type DocType = 'readme' | 'prd' | 'pricing';

interface DocumentPageProps {
  docType: DocType;
}

// Map doc types to their content and titles
const DOCUMENTS: Record<DocType, { title: string; content: string }> = {
  readme: {
    title: 'README',
    content: readmeContent,
  },
  prd: {
    title: 'Product Requirements Document',
    content: prdContent,
  },
  pricing: {
    title: 'Pricing Engine Documentation',
    content: pricingContent,
  },
};

export function DocumentPage({ docType }: DocumentPageProps) {
  const doc = DOCUMENTS[docType];

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Document content with prose styling for light theme */}
        <article className="prose prose-sm max-w-none
          prose-headings:text-ussf-navy prose-headings:font-bold prose-headings:font-[var(--font-headline)]
          prose-h1:text-2xl prose-h1:border-b prose-h1:border-gray-200 prose-h1:pb-3 prose-h1:mb-6
          prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4
          prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
          prose-p:text-gray-700 prose-p:leading-relaxed
          prose-a:text-ussf-red prose-a:no-underline hover:prose-a:underline
          prose-strong:text-ussf-navy prose-strong:font-semibold
          prose-code:text-ussf-red prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
          prose-pre:bg-transparent prose-pre:p-0
          prose-ul:text-gray-700 prose-ol:text-gray-700
          prose-li:marker:text-ussf-red
          prose-table:border-collapse
          prose-th:bg-ussf-navy prose-th:text-white prose-th:px-4 prose-th:py-2 prose-th:border prose-th:border-gray-300 prose-th:text-left
          prose-td:px-4 prose-td:py-2 prose-td:border prose-td:border-gray-300 prose-td:text-gray-700
          prose-blockquote:border-l-ussf-red prose-blockquote:bg-gray-50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r prose-blockquote:text-gray-600
          prose-hr:border-gray-200
        ">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const codeString = String(children).replace(/\n$/, '');

                // Check if this is inline code (no language class and short content)
                const isInline = !match && !codeString.includes('\n');

                if (isInline) {
                  // Inline code - use default styling
                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                }

                // Code block - use syntax highlighter
                return (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match ? match[1] : 'text'}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                    }}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                );
              },
            }}
          >
            {doc.content}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
}

// Keep the old modal export for backwards compatibility but it's no longer used
export function DocumentationModal(_props: { isOpen: boolean; onClose: () => void }) {
  return null;
}
