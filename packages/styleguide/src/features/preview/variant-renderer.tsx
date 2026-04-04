import { loadStoryByPath } from './story-loader';
import { parseVariants } from '../../data/story-module-parser';
import { MswProvider } from './msw-provider';
import { MswVariantHandlers } from './msw-variant-handlers';
import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import type { ControlsMap } from './control-types';

interface VariantRendererProps {
  slug: string;
  variant: string;
  /** Glob-relative path passed from the server-side page */
  storyPath: string;
}

export function VariantRenderer({ slug, variant: variantName, storyPath }: VariantRendererProps) {
  const [mod, setMod] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [dynamicProps, setDynamicProps] = useState<Record<string, unknown>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadStoryByPath(storyPath).then((m) => {
      if (!cancelled) {
        setMod(m);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [storyPath]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'styleguide:updateProps') {
        setDynamicProps(event.data.props);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  if (loading) {
    return <div style={{ color: 'var(--color-fg-muted)', padding: '12px' }}>Loading story...</div>;
  }

  if (!mod) {
    return <div className="text-danger p-hsp-md">Story not found: {slug}</div>;
  }

  const controls = (mod.controls ?? undefined) as ControlsMap | undefined;
  const variants = parseVariants(mod);
  const variant = variants.find((v) => v.name === variantName);

  if (!variant) {
    return (
      <div className="text-danger p-hsp-md">
        Variant not found: {variantName} in {slug}
      </div>
    );
  }

  const baseArgs = variant.args ?? {};
  const args = controls ? { ...baseArgs, ...dynamicProps } : baseArgs;

  let rendered: ReactNode;

  if (variant.render) {
    const RenderFn = variant.render;
    rendered = <RenderFn {...args} />;
  } else {
    rendered = <div className="text-danger">No render function for variant</div>;
  }

  const allDecorators = [...(variant.decorators ?? [])];

  if (allDecorators.length > 0) {
    for (let i = allDecorators.length - 1; i >= 0; i--) {
      const decorator = allDecorators[i];
      const inner = rendered;
      const Wrapper = (function (capturedInner: ReactNode) {
        return function DecoratorWrapper() {
          return <>{capturedInner}</>;
        };
      })(inner);
      rendered = <>{decorator(Wrapper as any, { parameters: variant.parameters ?? {} })}</>;
    }
  }

  const variantHandlers = variant.parameters?.msw?.handlers as any[] | undefined;

  const content = (
    <div className="p-hsp-md">{rendered}</div>
  );

  if (variantHandlers && variantHandlers.length > 0) {
    return (
      <MswProvider>
        <MswVariantHandlers handlers={variantHandlers}>{content}</MswVariantHandlers>
      </MswProvider>
    );
  }

  if (variant.parameters?.msw !== undefined) {
    return <MswProvider>{content}</MswProvider>;
  }

  return content;
}
