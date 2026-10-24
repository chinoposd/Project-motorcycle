export interface SupabaseEnvironment {
  url?: string;
  publishableKey?: string;
}

export type SupabaseConfig =
  | { mode: 'configured'; url: string; publishableKey: string }
  | { mode: 'unconfigured'; reason: 'missing-values' | 'invalid-project-url' | 'invalid-publishable-key' };

export function readSupabaseConfig(values: SupabaseEnvironment): SupabaseConfig {
  const urlValue = values.url?.trim() ?? '';
  const publishableKey = values.publishableKey?.trim() ?? '';
  if (!urlValue || !publishableKey) return { mode: 'unconfigured', reason: 'missing-values' };

  let projectUrl: URL;
  try {
    projectUrl = new URL(urlValue);
  } catch {
    return { mode: 'unconfigured', reason: 'invalid-project-url' };
  }
  if (projectUrl.protocol !== 'https:'
    || !projectUrl.hostname.endsWith('.supabase.co')
    || projectUrl.username
    || projectUrl.password
    || (projectUrl.pathname !== '/' && projectUrl.pathname !== '')
    || projectUrl.search
    || projectUrl.hash) {
    return { mode: 'unconfigured', reason: 'invalid-project-url' };
  }
  if (!publishableKey.startsWith('sb_publishable_') || publishableKey.length < 30) {
    return { mode: 'unconfigured', reason: 'invalid-publishable-key' };
  }

  return { mode: 'configured', url: projectUrl.origin, publishableKey };
}
