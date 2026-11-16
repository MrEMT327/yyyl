type GuideBounds = Pick<DOMRectReadOnly, 'left' | 'right' | 'top' | 'bottom' | 'width'>;

interface GuidePlacementOptions {
  target: GuideBounds;
  bounds: GuideBounds;
  label: string;
  viewport?: { width: number; height: number };
}

export function guidePointerMarkup(): string;
export function guideMascotMarkup(): string;
export function guideCompanionMarkup(): string;
export function guideMarkup(): string;
export function positionGuide(layer: HTMLElement, options: GuidePlacementOptions): boolean;
