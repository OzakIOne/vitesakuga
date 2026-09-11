export const seo = ({
  title,
  description,
  keywords,
  image,
  noIndex = false,
  url,
}: {
  title: string;
  description?: string;
  image?: string;
  keywords?: string;
  noIndex?: boolean;
  url?: string;
}) => {
  const tags = [
    { title },
    { content: description, name: "description" },
    { content: keywords, name: "keywords" },
    { content: title, name: "twitter:title" },
    { content: description, name: "twitter:description" },
    {
      content: image ? "summary_large_image" : "summary",
      name: "twitter:card",
    },
    { content: "website", name: "og:type" },
    { content: title, name: "og:title" },
    { content: description, name: "og:description" },
    ...(noIndex ? [{ content: "noindex, nofollow", name: "robots" }] : []),
    ...(url ? [{ content: url, name: "og:url" }] : []),
    { content: "ViteSakuga", name: "og:site_name" },
    { content: "en_US", name: "og:locale" },
    ...(image
      ? [
          { content: image, name: "twitter:image" },
          { content: image, name: "og:image" },
        ]
      : []),
  ];

  return tags;
};
