import { useState } from "react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { Button } from "src/components/ui/button";
import { Box, HStack } from "src/components/ui/layout";
import { Image } from "src/components/ui/media";
import { assetUrl } from "src/lib/assets/url";
import Lightbox from "yet-another-react-lightbox";
import Download from "yet-another-react-lightbox/plugins/download";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Zoom from "yet-another-react-lightbox/plugins/zoom";

import "yet-another-react-lightbox/styles.css";

type PostImageGalleryProps = {
  images: string[];
  title: string;
};

export function PostImageGallery({ images, title }: PostImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  if (images.length === 0) {
    return null;
  }

  const slides = images.map((key, index) => ({
    alt: title || "Post image",
    download: true,
    src: assetUrl(key),
    index,
  }));
  const activeSlide = slides[activeIndex];

  const move = (offset: number) => {
    setActiveIndex((current) => {
      const next = current + offset;
      if (next < 0) {
        return images.length - 1;
      }
      if (next >= images.length) {
        return 0;
      }
      return next;
    });
  };

  return (
    <section aria-label="Post image gallery">
      <div className="group relative overflow-hidden rounded-md">
        <button
          aria-keyshortcuts="ArrowLeft ArrowRight"
          aria-label={
            "Open image " + (activeIndex + 1) + " of " + images.length
          }
          className="block w-full cursor-zoom-in focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
          onClick={() => setIsLightboxOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              move(event.key === "ArrowLeft" ? -1 : 1);
            }
          }}
          type="button"
        >
          {activeSlide && (
            <Image
              alt={activeSlide.alt}
              className="block max-h-[min(75vh,900px)] w-full object-contain"
              src={activeSlide.src}
            />
          )}
        </button>
        {images.length > 1 && (
          <>
            <Button
              aria-label="Previous image"
              className="absolute top-1/2 left-3 -translate-y-1/2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                move(-1);
              }}
              size="sm"
              variant="solid"
            >
              <LuChevronLeft />
            </Button>
            <Button
              aria-label="Next image"
              className="absolute top-1/2 right-3 -translate-y-1/2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                move(1);
              }}
              size="sm"
              variant="solid"
            >
              <LuChevronRight />
            </Button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <nav aria-label="Post image thumbnails">
          <HStack gap={2} mt={2} overflowX="auto">
            {slides.map((slide, index) => (
              <button
                aria-current={index === activeIndex ? "true" : undefined}
                aria-label={
                  "Show image " + (index + 1) + " of " + images.length
                }
                className={
                  index === activeIndex
                    ? "w-20 shrink-0 overflow-hidden rounded border-2 border-blue-500 p-0"
                    : "w-20 shrink-0 overflow-hidden rounded border-2 border-transparent p-0 opacity-70 hover:opacity-100"
                }
                key={slide.src}
                onClick={() => setActiveIndex(index)}
                type="button"
              >
                <Image
                  alt=""
                  className="aspect-square w-full object-cover"
                  src={slide.src}
                />
              </button>
            ))}
          </HStack>
        </nav>
      )}

      <Box color="fg.muted" fontSize="sm" mt={2} textAlign="center">
        Image {activeIndex + 1} of {images.length} · Use ←/→ to navigate
      </Box>

      <Lightbox
        close={() => setIsLightboxOpen(false)}
        index={activeIndex}
        on={{
          view: ({ index }) => setActiveIndex(index),
        }}
        open={isLightboxOpen}
        plugins={[Download, Fullscreen, Zoom]}
        slides={slides}
        zoom={{ maxZoomPixelRatio: 5, scrollToZoom: true }}
      />
    </section>
  );
}
