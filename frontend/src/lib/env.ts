export const env = {
  apiBase: (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:4000',
  /** Public documentation (e.g. GitHub README). */
  docsUrl:
    (import.meta.env.VITE_DOCS_URL as string | undefined) ??
    'https://github.com/nikhilvirdi/RedFlag-CI/blob/main/README.md',
} as const

