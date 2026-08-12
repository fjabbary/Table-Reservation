export function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="rounded-lg bg-red-100 px-4 py-3 text-sm text-red-900 dark:bg-red-900/30 dark:text-red-200">
      {message}
    </p>
  );
}
