import { getModuleBySlugSync } from '../../data/stories';
import { MswProvider } from './msw-provider';
import { MswVariantHandlers } from './msw-variant-handlers';
import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';

interface VariantRendererProps {
  slug: string;
  variant: string;
}

export function VariantRenderer({ slug, variant: variantName }: VariantRendererProps) {
  const module = getModuleBySlugSync(slug);
  const hasControls = Boolean(module?.controls);
  const [dynamicProps, setDynamicProps] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!hasControls) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'styleguide:updateProps') {
        setDynamicProps(event.data.props);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [hasControls]);

  if (!module) {
    return <div className="text-danger p-hsp-md">Story not found: {slug}</div>;
  }

  const variant = module.variants.find((v) => v.name === variantName);

  if (!variant) {
    return (
      <div className="text-danger p-hsp-md">
        Variant not found: {variantName} in {slug}
      </div>
    );
  }

  const Component = module.component;
  const baseArgs = variant.args ?? {};
  const args = module.controls ? { ...baseArgs, ...dynamicProps } : baseArgs;

  let rendered: ReactNode;

  if (variant.render) {
    const RenderFn = variant.render;
    rendered = <RenderFn {...args} />;
  } else if (Component) {
    rendered = <Component {...args} />;
  } else {
    rendered = <div className="text-danger">No component or render function</div>;
  }

  const allDecorators = [...(module.decorators ?? []), ...(variant.decorators ?? [])];

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

  const moduleHandlers = module.parameters?.msw?.handlers as any[] | undefined;
  const variantHandlers = variant.parameters?.msw?.handlers as any[] | undefined;
  const allHandlers = [...(moduleHandlers ?? []), ...(variantHandlers ?? [])];

  const content = (
    <div className="p-hsp-md">{rendered}</div>
  );

  if (allHandlers.length > 0) {
    return (
      <MswProvider>
        <MswVariantHandlers handlers={allHandlers}>{content}</MswVariantHandlers>
      </MswProvider>
    );
  }

  if (module.parameters?.msw !== undefined || variant.parameters?.msw !== undefined) {
    return <MswProvider>{content}</MswProvider>;
  }

  return content;
}
