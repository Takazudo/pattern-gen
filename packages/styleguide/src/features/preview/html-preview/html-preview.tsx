import { useCallback, useMemo } from 'react';
import PreviewBase from './preview-base';
import { dedent } from '../../../utils/dedent';
import { preflightCss } from './preflight';

interface HtmlPreviewProps {
  html: string;
  css?: string;
  head?: string;
  js?: string;
  title?: string;
  height?: number;
  defaultOpen?: boolean;
  /** Per-component css for code block display (before global merge) */
  componentCss?: string;
  /** Per-component head for code block display (before global merge) */
  componentHead?: string;
  /** Per-component js for code block display (before global merge) */
  componentJs?: string;
}

function containsScript(head?: string, js?: string): boolean {
  if (js) return true;
  if (head && /<script/i.test(head)) return true;
  return false;
}

export function buildSrcdoc(html: string, css?: string, head?: string, js?: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${preflightCss}</style>
${head ?? ''}
${css ? `<style>${css}</style>` : ''}
</head>
<body>${html}
${js ? `<script>${js}</script>` : ''}
</body>
</html>`;
}

/**
 * Replace the component portion inside a merged (global + component) string.
 * Merged strings follow the pattern: [globalPart, componentPart].join('\n'),
 * so the component part is always a suffix. Slice-based replacement avoids the
 * first-match-only limitation of String.replace when the component text repeats.
 */
function replaceMergedPart(
  merged: string | undefined,
  originalComponent: string | undefined,
  editedComponent: string | undefined,
): string | undefined {
  if (originalComponent == null || editedComponent == null) return merged;
  if (originalComponent === editedComponent) return merged;
  if (!merged) return editedComponent;
  if (merged === originalComponent) return editedComponent;
  if (merged.endsWith(originalComponent)) {
    return merged.slice(0, merged.length - originalComponent.length) + editedComponent;
  }
  // Fallback for unexpected merge shapes
  return merged.replace(originalComponent, editedComponent);
}

export default function HtmlPreview({
  html,
  css,
  head,
  js,
  title,
  height,
  defaultOpen,
  componentCss,
  componentHead,
  componentJs,
}: HtmlPreviewProps) {
  const srcdoc = useMemo(() => buildSrcdoc(html, css, head, js), [html, css, head, js]);
  const hasScripts = containsScript(head, js);
  const syncDelay = hasScripts ? 300 : 0;
  // allow-same-origin is needed alongside allow-scripts so that syncHeight
  // can access iframe.contentDocument for auto-height measurement
  const sandboxValue = hasScripts ? 'allow-scripts allow-same-origin' : '';

  const codeBlocks = useMemo(
    () => [
      { language: 'html', title: 'HTML', code: dedent(html) },
      ...(componentCss ? [{ language: 'css', title: 'CSS', code: dedent(componentCss) }] : []),
      ...(componentHead ? [{ language: 'html', title: 'Head', code: dedent(componentHead) }] : []),
      ...(componentJs
        ? [
            {
              language: 'javascript',
              title: 'JS',
              code: dedent(componentJs),
            },
          ]
        : []),
    ],
    [html, componentCss, componentHead, componentJs],
  );

  // Rebuild srcdoc from edited code block values.
  // Edited values are dedented (matching what the editor shows), so we rebuild
  // by replacing the component portion in the merged global+component strings.
  // For CSS/Head/JS, the merged string = global + "\n" + component, so we
  // replace the dedented component suffix with the edited value.
  const rebuildSrcdoc = useCallback(
    (editedBlocks: Record<string, string>) => {
      const editedHtml = editedBlocks['HTML'] ?? html;
      const dedentedCss = componentCss ? dedent(componentCss) : undefined;
      const dedentedHead = componentHead ? dedent(componentHead) : undefined;
      const dedentedJs = componentJs ? dedent(componentJs) : undefined;
      const newCss = replaceMergedPart(css, dedentedCss, editedBlocks['CSS']);
      const newHead = replaceMergedPart(head, dedentedHead, editedBlocks['Head']);
      const newJs = replaceMergedPart(js, dedentedJs, editedBlocks['JS']);
      return buildSrcdoc(editedHtml, newCss, newHead, newJs);
    },
    [html, css, head, js, componentCss, componentHead, componentJs],
  );

  return (
    <PreviewBase
      title={title}
      height={height}
      srcdoc={srcdoc}
      defaultOpen={defaultOpen}
      sandbox={sandboxValue}
      syncDelay={syncDelay}
      codeBlocks={codeBlocks}
      rebuildSrcdoc={rebuildSrcdoc}
    />
  );
}
