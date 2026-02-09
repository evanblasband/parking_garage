/**
 * DocumentPage Component
 *
 * Displays project documentation from actual markdown files.
 * Uses react-markdown for rendering with Tailwind typography styles.
 * Simulation continues running in the background while viewing docs.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    <div className="h-full overflow-y-auto bg-wc-blue">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Document content with prose styling */}
        <article className="prose prose-invert prose-sm max-w-none
          prose-headings:text-wc-accent prose-headings:font-bold
          prose-h1:text-2xl prose-h1:border-b prose-h1:border-gray-700 prose-h1:pb-3 prose-h1:mb-6
          prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4
          prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
          prose-p:text-gray-300 prose-p:leading-relaxed
          prose-a:text-wc-red prose-a:no-underline hover:prose-a:underline
          prose-strong:text-white prose-strong:font-semibold
          prose-code:text-wc-red prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
          prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-700 prose-pre:rounded-lg
          prose-ul:text-gray-300 prose-ol:text-gray-300
          prose-li:marker:text-gray-500
          prose-table:border-collapse
          prose-th:bg-gray-800 prose-th:px-4 prose-th:py-2 prose-th:border prose-th:border-gray-700 prose-th:text-left prose-th:text-white
          prose-td:px-4 prose-td:py-2 prose-td:border prose-td:border-gray-700 prose-td:text-gray-300
          prose-blockquote:border-l-wc-red prose-blockquote:bg-gray-800/50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r
          prose-hr:border-gray-700
        ">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
