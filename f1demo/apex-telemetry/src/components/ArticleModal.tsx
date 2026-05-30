import { ExternalLink, X } from 'lucide-react';

interface Props {
  url: string | null;
  title?: string;
  onClose: () => void;
}

export function ArticleModal({ url, title, onClose }: Props) {
  if (!url) return null;
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-5xl h-[85vh] bg-surface-dim border border-white/10 rounded-lg flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-surface-container shrink-0">
          <span className="font-mono text-xs text-on-surface-variant uppercase tracking-wider truncate max-w-[70%]">
            {title || url}
          </span>
          <div className="flex items-center gap-3">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] text-f1-red hover:underline flex items-center gap-1 uppercase font-bold"
            >
              Open externally <ExternalLink size={10} />
            </a>
            <button
              onClick={onClose}
              className="text-on-surface-variant hover:text-white transition-colors"
              aria-label="Close article"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <iframe
          src={url}
          title={title || 'Article'}
          className="flex-1 w-full bg-white"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>
    </div>
  );
}
