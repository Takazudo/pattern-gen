import type { ProcessedImage } from '@takazudo/pattern-gen-image-processor';
import type { ImageTransform } from '../components/image-overlay-transform.js';

export interface ViewerImageLayer {
  id: string;
  name: string;
  processed: ProcessedImage | null;
  originalFile?: File;
  opacity: number; // 0-100
  bgThreshold: number; // 0-255
  bgRemovalEnabled: boolean;
  /** Whether ML bg removal has been run (alphaMask is real, not dummy) */
  hasBgRemovalData: boolean;
  transform: ImageTransform | null;
  keepAspectRatio: boolean;
  isProcessing: boolean;
  processingProgress: number;
  error: string | null;
  thresholdedCache?: ImageData | null;
}
