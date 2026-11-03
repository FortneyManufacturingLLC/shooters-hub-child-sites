export interface PageSection { id: string; visible: boolean }
export interface PageLayout { version: 1; sections: PageSection[] }
export function validatePageLayout(input: unknown, registry: readonly string[]): PageLayout;
export function defaultPageLayout(registry: readonly string[]): PageLayout;
export function movePageSection(layout: PageLayout, id: string, offset: number, registry: readonly string[]): PageLayout;

export interface SectionDefinition { id: string; label: string }
export interface PageEditorOptions { registry: SectionDefinition[]; value: PageLayout; onChange: (layout: PageLayout) => void; announce?: (message: string) => void; history?: { limit?: number; controls?: HTMLElement } }
export function mountPageEditor(container: HTMLElement, options: PageEditorOptions): { update(layout: PageLayout): void; undo(): boolean; redo(): boolean; canUndo(): boolean; canRedo(): boolean; destroy(): void };
