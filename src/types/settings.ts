/** Defines a single configurable setting for a dapp. */
export interface SettingDefinition {
  /** Unique key within the dapp, e.g. 'defaultCategory'. */
  key: string;
  /** Human-readable label. */
  label: string;
  /** Input type for form generation. */
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect';
  /** Default value. */
  default: unknown;
  /** Help text shown below the input. */
  description?: string;
  /** Options for select/multiselect types. */
  options?: { label: string; value: string }[];
  /** Validation constraints. */
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
  /** Key of a boolean setting in the same section that this field depends on. When the referenced setting is falsy, this field is disabled/grayed out. */
  dependsOn?: string;
}

/** A group of setting definitions with identity and display label. */
export interface SettingsSection {
  /** Section identifier (dapp ID, plugin name, or reserved namespace like '_shell'). */
  id: string;
  /** Human-readable section heading. */
  label: string;
  /** Setting definitions in this section. */
  definitions: SettingDefinition[];
}

/** Settings API exposed on DxKit context. */
export interface Settings {
  /** Get a setting value. Returns the default from the manifest if not explicitly set. */
  get<T = unknown>(dappId: string, key: string): T | undefined;
  /** Set a setting value. */
  set(dappId: string, key: string, value: unknown): void;
  /** Get all settings for a dapp as a key-value map. */
  getAll(dappId: string): Record<string, unknown>;
  /** Get all setting sections (dapps, plugins, shell-level). */
  getSections(): SettingsSection[];
  /** Subscribe to changes for a specific setting. Returns unsubscribe. */
  onChange(dappId: string, key: string, handler: (value: unknown) => void): () => void;
  /** Subscribe to any setting change for a dapp. Returns unsubscribe. */
  onAnyChange(dappId: string, handler: (key: string, value: unknown) => void): () => void;
}
