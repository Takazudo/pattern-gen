import { autocompletion } from '@codemirror/autocomplete';
import type { CompletionContext, CompletionResult, Completion } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import twData from '../../data/tw-classes.json';

interface TwClassEntry {
  label: string;
  detail: string;
  section: string;
}

// Pre-build options array once at module load
const twClassList = (twData as { classes: TwClassEntry[] }).classes;
const completionOptions: Completion[] = twClassList.map((entry) => ({
  label: entry.label,
  detail: entry.detail,
  type: 'class',
  section: entry.section,
  boost: entry.section === 'layout' ? 2 : entry.section === 'spacing' ? 1 : 0,
}));

function twCompletionSource(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const textBefore = line.text.slice(0, context.pos - line.from);

  // Check if we're inside a class/className attribute value
  const classAttrMatch = textBefore.match(
    /(?:class|className)\s*=\s*(?:"[^"]*$|'[^']*$|{`[^`]*$|{'[^']*$)/,
  );

  // Only suggest classes inside class/className attribute values
  if (!classAttrMatch) return null;

  // Get the partial class name being typed
  const wordMatch = context.matchBefore(/[\w\-/]*/);
  if (!wordMatch) return null;

  return {
    from: wordMatch.from,
    options: completionOptions,
    validFor: /^[\w\-/]*$/,
  };
}

export function tailwindCompletion() {
  return [
    autocompletion({
      activateOnTyping: true,
      maxRenderedOptions: 50,
    }),
    EditorState.languageData.of(() => [{ autocomplete: twCompletionSource }]),
  ];
}
