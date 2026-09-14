const MAIN_CONTENT_ID = "main-content";

export function SkipToContentLink() {
  const focusMainContent = () => {
    document.getElementById(MAIN_CONTENT_ID)?.focus();
  };

  return (
    <a
      className="focus:text-tone-900 dark:focus:bg-tone-900 dark:focus:text-tone-100 sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md"
      href={`#${MAIN_CONTENT_ID}`}
      onClick={focusMainContent}
    >
      Skip to content
    </a>
  );
}
