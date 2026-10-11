'use client';

import type { FinalAnswer } from '@dear-steven/core/schema';
import { ImageDownloadIcon, Link01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';
import { useToast } from '@/components/ui/Toasts';
import { useI18n } from '@/i18n/I18nProvider';
import { shareLink } from '@/lib/share';
import { cardContent, drawShareCard } from '@/lib/share-card';

const BUTTON =
  'inline-flex h-8 items-center gap-2 rounded-full border border-ink-3 px-3 text-[13px] text-ivory-1 transition-colors hover:border-ink-4 hover:text-ivory-0 disabled:opacity-60';

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Share a finished answer (P6-17): a link that opens it with its sources, or an image card. */
export function ShareControls({ question, answer }: { question: string; answer: FinalAnswer }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [drawing, setDrawing] = useState(false);
  const token = answer.share;
  if (!token) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink(window.location.origin, token));
      toast({
        id: 'share',
        title: t.share.copied,
        description: t.share.copiedBody,
        tone: 'ember',
        duration: 3200,
      });
    } catch {
      toast({ id: 'share', title: t.errors.clipboard, tone: 'error', duration: 3200 });
    }
  };

  const saveImage = async () => {
    setDrawing(true);
    try {
      const card = await drawShareCard(cardContent(question, answer), t, window.location.host);
      download(card, t.share.fileName);
    } catch {
      toast({ id: 'share', title: t.share.imageFailed, tone: 'error', duration: 4200 });
    } finally {
      setDrawing(false);
    }
  };

  return (
    <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-ink-3 pt-5">
      <button type="button" onClick={copyLink} className={BUTTON}>
        <HugeiconsIcon icon={Link01Icon} size={14} strokeWidth={2} />
        {t.share.copyLink}
      </button>
      <button
        type="button"
        onClick={saveImage}
        disabled={drawing}
        aria-busy={drawing}
        className={BUTTON}
      >
        <HugeiconsIcon icon={ImageDownloadIcon} size={14} strokeWidth={2} />
        {drawing ? t.share.saving : t.share.saveImage}
      </button>
      <p className="basis-full text-[12.5px] leading-relaxed text-ivory-2">{t.share.note}</p>
    </div>
  );
}
