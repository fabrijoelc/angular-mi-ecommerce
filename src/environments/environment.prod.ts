// Valores de produccion. Son los mismos: todos son datos publicos.
const PROYECTO = 'https://ldegqztunrgpjtakngzs.supabase.co';

export const environment = {
  supabaseUrl: `${PROYECTO}/rest/v1`,
  supabaseAuthUrl: `${PROYECTO}/auth/v1`,
  supabaseFuncionesUrl: `${PROYECTO}/functions/v1`,
  supabaseKey: 'sb_publishable_3e9_iVE1wqHvEtyFNPXlGw__f2T496x',
  // La site key del captcha es publica y por eso puede ir aqui. La secret
  // key solo existe en los secrets de Supabase.
  turnstileSiteKey: '0x4AAAAAAFLS9rzC4M6c_Blh',
};
