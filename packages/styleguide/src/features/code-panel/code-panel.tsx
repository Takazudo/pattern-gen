import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useCodePanel } from './use-code-panel';
import {
  injectCssToAllIframes,
  reloadAllIframes,
  removeCssFromAllIframes,
} from '../../lib/iframe-registry';
import type { RelatedSource } from '../../data/stories';

// Lazy-load StorySourceEditor (CodeMirror) — only when code panel is visible
const StorySourceEditor = lazy(() => import('./story-source-editor'));

interface CodePanelProps {
  relatedSources: RelatedSource[];
  storySource?: string;
}

function isCssFile(filename: string): boolean {
  return filename.endsWith('.css');
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

async function saveSourceFile(relativePath: string, content: string): Promise<void> {
  const res = await fetch('/api/save-source', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ relativePath, content }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
}

export default function CodePanel({ relatedSources, storySource }: CodePanelProps) {
  const [visible] = useCodePanel();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const cssDebounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const savedTimer = useRef<ReturnType<typeof setTimeout>>();
  const devSaveAvailable = useRef(true);
  const saveFailCount = useRef(0);

  // Track dirty (edited) non-CSS files: filename → latest content
  const dirtyFiles = useRef<Map<string, string>>(new Map());
  const [hasDirtyFiles, setHasDirtyFiles] = useState(false);

  // Build filename → relativePath lookup
  const pathLookup = useRef<Map<string, string>>(new Map());
  const nextPathLookup = new Map<string, string>();
  for (const rs of relatedSources) {
    nextPathLookup.set(rs.filename, rs.relativePath);
  }
  pathLookup.current = nextPathLookup;

  // Clean up timers on unmount
  useEffect(() => {
    const timers = cssDebounceTimers.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  const handleSourceChange = useCallback((filename: string, content: string) => {
    if (isCssFile(filename)) {
      // CSS: live injection (debounced 300ms) — CSS can't cause compile errors
      const prev = cssDebounceTimers.current.get(filename);
      if (prev) clearTimeout(prev);
      const timer = setTimeout(() => {
        injectCssToAllIframes(filename, content);
        cssDebounceTimers.current.delete(filename);
      }, 300);
      cssDebounceTimers.current.set(filename, timer);
      return;
    }

    // Non-CSS: track as dirty, don't auto-save (user clicks Save when ready)
    dirtyFiles.current.set(filename, content);
    setHasDirtyFiles(true);
  }, []);

  const handleSave = useCallback(() => {
    if (dirtyFiles.current.size === 0 || !devSaveAvailable.current) return;

    if (savedTimer.current) clearTimeout(savedTimer.current);
    setSaveStatus('saving');

    // Save all dirty files in parallel
    const saves = Array.from(dirtyFiles.current.entries()).map(([filename, content]) => {
      const relativePath = pathLookup.current.get(filename);
      if (!relativePath) return Promise.resolve();
      return saveSourceFile(relativePath, content);
    });

    Promise.all(saves)
      .then(() => {
        saveFailCount.current = 0;
        dirtyFiles.current.clear();
        setHasDirtyFiles(false);
        setSaveStatus('saved');
        savedTimer.current = setTimeout(() => setSaveStatus('idle'), 1500);
      })
      .catch(() => {
        saveFailCount.current += 1;
        if (saveFailCount.current >= 3) {
          devSaveAvailable.current = false;
        }
        setSaveStatus('error');
        savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2000);
      });
  }, []);

  const handleReloadPreviews = useCallback(() => {
    for (const timer of cssDebounceTimers.current.values()) clearTimeout(timer);
    cssDebounceTimers.current.clear();
    devSaveAvailable.current = true;
    reloadAllIframes();
  }, []);

  // Track relatedSources via ref so cleanup only runs on unmount
  const relatedSourcesRef = useRef(relatedSources);
  relatedSourcesRef.current = relatedSources;

  // Clean up injected CSS when component unmounts
  useEffect(() => {
    return () => {
      for (const rs of relatedSourcesRef.current) {
        if (isCssFile(rs.filename)) {
          removeCssFromAllIframes(rs.filename);
        }
      }
    };
  }, []);

  const hasContent = relatedSources.length > 0 || storySource;
  if (!hasContent || !visible) return null;

  return (
    <aside
      id="code-panel"
      className="hidden lg:block shrink-0 w-[var(--code-panel-w)] border-l border-muted sticky top-[3.5rem] h-[calc(100vh-3.5rem)] overflow-y-auto relative"
      aria-label="Source code"
    >
      {/* Floating toast — top-right of code panel */}
      {saveStatus !== 'idle' && (
        <div
          role="status"
          className={[
            'absolute top-vsp-xs right-hsp-sm z-20 px-hsp-md py-vsp-3xs rounded-lg text-xs font-semibold shadow-lg transition-opacity duration-200 pointer-events-none',
            saveStatus === 'saving' ? 'bg-surface border border-muted text-muted' : '',
            saveStatus === 'saved' ? 'bg-success text-bg' : '',
            saveStatus === 'error' ? 'bg-danger text-bg' : '',
          ].join(' ')}
        >
          {saveStatus === 'saving' && 'Saving...'}
          {saveStatus === 'saved' && 'Updated!'}
          {saveStatus === 'error' && 'Save failed'}
        </div>
      )}

      <Suspense fallback={<div className="px-hsp-lg py-vsp-md text-xs text-muted">Loading...</div>}>
        <div className="px-hsp-lg py-vsp-md">
          {/* Save button — shown when files are dirty */}
          {hasDirtyFiles && devSaveAvailable.current && (
            <div className="mb-vsp-sm flex justify-end">
              <button
                type="button"
                className="px-hsp-md py-vsp-3xs text-xs font-semibold border rounded-lg cursor-pointer transition-colors duration-150 leading-snug bg-accent text-bg border-accent hover:bg-accent-hover"
                onClick={handleSave}
              >
                Save & Apply
              </button>
            </div>
          )}

          {relatedSources.length > 0 && (
            <div>
              <h2 className="text-sm font-sans font-normal text-muted mb-vsp-xs">
                Component Source
              </h2>
              <div className="flex flex-col gap-vsp-sm">
                {relatedSources.map((rs) => (
                  <div key={rs.filename}>
                    <p className="text-xs font-mono text-muted mb-vsp-2xs">{rs.filename}</p>
                    <StorySourceEditor
                      source={rs.source}
                      filename={rs.filename}
                      onChange={handleSourceChange}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {storySource && (
            <div
              className={relatedSources.length > 0 ? 'mt-vsp-md border-t border-p6 pt-vsp-md' : ''}
            >
              <h2 className="text-sm font-sans font-normal text-muted mb-vsp-xs">Story Source</h2>
              <StorySourceEditor source={storySource} />
            </div>
          )}
        </div>
      </Suspense>
    </aside>
  );
}
