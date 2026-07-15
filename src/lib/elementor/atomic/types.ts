export type AtomicVariableType =
  | "global-color-variable"
  | "global-font-variable"
  | "global-size-variable";

export interface AtomicVariable {
  id: string;
  type: AtomicVariableType;
  label: string;
  value: string;
  order: number;
}

export interface AtomicProp<T = unknown> {
  $$type: string;
  value: T;
}

export interface AtomicStyleVariant {
  meta: {
    breakpoint: "desktop" | "tablet" | "mobile";
    state: string | null;
  };
  props: Record<string, AtomicProp>;
}

export interface AtomicGlobalClass {
  id: string;
  type: "class";
  label: string;
  variants: AtomicStyleVariant[];
}

export interface AtomicElement {
  id: string;
  version: "0.0";
  elType: string;
  widgetType?: string;
  settings: Record<string, AtomicProp | unknown>;
  editor_settings: Record<string, unknown>;
  interactions: unknown[];
  styles: unknown[] | Record<string, AtomicGlobalClass>;
  elements: AtomicElement[];
}

export interface AtomicComponentDefinition {
  uid: string;
  title: string;
  elements: AtomicElement[];
  settings?: Record<string, unknown>;
}

export interface AtomicFoundation {
  name: string;
  version: string;
  minimumElementorVersion: string;
  variables: AtomicVariable[];
  classes: AtomicGlobalClass[];
  components: AtomicComponentDefinition[];
}
