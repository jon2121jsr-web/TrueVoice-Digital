import { Buffer } from 'node:buffer';

// Vercel supplies this at build/runtime. Never accept a request/header flag.
export function classifyDeployment(env) {
  const environment = env.VERCEL_ENV;
  const target = env.VERCEL_TARGET_ENV;
  const platformPresent = ['VERCEL', 'VERCEL_ENV', 'VERCEL_TARGET_ENV', 'VERCEL_URL', 'VERCEL_DEPLOYMENT_ID']
    .some(name => env[name] !== undefined);
  if (env.VERCEL !== undefined && env.VERCEL !== '1') return 'unsafe';
  if (environment === 'production' && target === 'production') return 'production';
  if (environment === 'preview' && target === 'preview') return 'preview';
  if (environment === 'development' && target === 'development') return 'development';
  if (!platformPresent && env.NODE_ENV === 'development') return 'development';
  // Custom environment slugs are not privileged; require a reviewed policy before use.
  return 'unsafe';
}

export function restrictedDeployment(env) {
  return !['production', 'development'].includes(classifyDeployment(env));
}

export const excludedPreviewCredentials = [
  'SUPABASE_SERVICE_KEY', 'SUPABASE_URL', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
  'PRINTFUL_API_KEY', 'FIREBASE_SERVICE_ACCOUNT_JSON', 'AZURACAST_API_KEY',
  'DROP_PORTAL_PASSWORD', 'CRON_SECRET', 'VITE_YOUTUBE_API_KEY',
];

export function assertPreviewConfiguration(env) {
  const fail = () => { throw new Error('Preview isolation configuration is incomplete'); };
  const classification = classifyDeployment(env);
  if (classification === 'unsafe') fail();
  if (classification !== 'preview') return;
  if (excludedPreviewCredentials.some(name => env[name])) fail();
  const ref = env.TRUEVOICE_PREVIEW_SUPABASE_REF;
  const productionRef = env.TRUEVOICE_PRODUCTION_SUPABASE_REF;
  if (!/^[a-z0-9]{20}$/.test(ref || '') || !/^[a-z0-9]{20}$/.test(productionRef || '') || ref === productionRef) fail();
  if (env.VITE_SUPABASE_URL !== `https://${ref}.supabase.co`) fail();
  // Current direct REST code expects the legacy public anon JWT, not a service key.
  try {
    const key = env.VITE_SUPABASE_ANON_KEY || '';
    if (key.split('.').length !== 3) fail();
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (claims.role !== 'anon' || claims.ref !== ref) fail();
  } catch { fail(); }
  if (!env.YOUTUBE_API_KEY || !/^AIza[0-9A-Za-z_-]{35}$/.test(env.YOUTUBE_API_KEY)) fail();
}
