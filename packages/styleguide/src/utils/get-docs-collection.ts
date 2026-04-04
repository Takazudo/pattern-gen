import { getCollection, type CollectionKey } from 'astro:content';
import type { DocsEntry } from '../types/docs-entry';

export async function getDocsCollection(name: CollectionKey | string): Promise<DocsEntry[]> {
  return (await getCollection(name as CollectionKey)) as unknown as DocsEntry[];
}
