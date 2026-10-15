export const IS_PREVIEW = !!import.meta.env?.TRUEVOICE_RESTRICTED_PREVIEW;

// Public Supabase credentials must not permit this guest preview to write or sign in.
export function previewReadOnlyFetch(baseUrl, fetcher = (...args) => fetch(...args)) {
  return (input, init = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    const method = (init.method || input.method || 'GET').toUpperCase();
    if (url.origin !== baseUrl || !['GET', 'HEAD'].includes(method) ||
        !/^\/(rest\/v1|storage\/v1\/object\/public)\//.test(url.pathname)) {
      return Promise.reject(new Error('Operation unavailable in Preview'));
    }
    return fetcher(input, init);
  };
}
