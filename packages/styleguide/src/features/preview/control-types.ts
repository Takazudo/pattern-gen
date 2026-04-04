/**
 * Control type definitions for dynamic prop controls in story previews.
 * Stories can export a `controls` object to enable real-time prop editing.
 */

export type ControlType = 'text' | 'boolean' | 'number' | 'select' | 'color';

export interface ControlDefBase {
  type: ControlType;
  default: unknown;
}

export interface TextControlDef extends ControlDefBase {
  type: 'text';
  default: string;
}

export interface BooleanControlDef extends ControlDefBase {
  type: 'boolean';
  default: boolean;
}

export interface NumberControlDef extends ControlDefBase {
  type: 'number';
  default: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface SelectControlDef extends ControlDefBase {
  type: 'select';
  default: string;
  options: string[];
}

export interface ColorControlDef extends ControlDefBase {
  type: 'color';
  default: string;
}

export type ControlDef =
  | TextControlDef
  | BooleanControlDef
  | NumberControlDef
  | SelectControlDef
  | ColorControlDef;

export type ControlsMap = Record<string, ControlDef>;
