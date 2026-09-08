const MAIN_CONTENT_ID = "main-content";

export function SkipToContentLink() {
  const focusMainContent = () => {
    document.getElementById(MAIN_CONTENT_ID)?.focus();
  };

  return (
    <a
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-gray-900 focus:shadow-md dark:focus:bg-gray-900 dark:focus:text-gray-100"
      href={`#${MAIN_CONTENT_ID}`}
      onClick={focusMainContent}
    >
      Skip to content
    </a>
  );
}
