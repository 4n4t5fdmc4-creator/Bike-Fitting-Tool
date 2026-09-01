/**
 * Marks the development build. The flag is baked in at build time from the same
 * environment variable that sets basePath, so the banner cannot disagree with
 * which build the visitor is actually looking at.
 */
export function EnvBanner() {
  if (process.env.NEXT_PUBLIC_ENV_NAME !== 'development') return null;
  return (
    <div className="bg-[var(--status-warning)] px-4 py-2 text-center text-xs font-semibold text-black">
      DEVELOPMENT BUILD — {process.env.NEXT_PUBLIC_ENV_SHA ?? 'local'}
    </div>
  );
}
