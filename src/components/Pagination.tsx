import { Button, HStack, IconButton, Text } from "@chakra-ui/react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) => {
  if (totalPages <= 1) return null;

  const lastPageIndex = totalPages - 1;
  const siblings = 1;
  const leftRange = Math.max(0, currentPage - siblings);
  const rightRange = Math.min(lastPageIndex, currentPage + siblings);

  const showFirst = leftRange > 0;
  const showLast = rightRange < lastPageIndex;

  return (
    <HStack gap={2} justify="center" mb={8} mt={8}>
      <IconButton
        aria-label="Previous page"
        disabled={currentPage <= 0}
        onClick={() => {
          onPageChange(currentPage - 1);
        }}
        variant="ghost"
      >
        <FiChevronLeft />
      </IconButton>

      {showFirst && (
        <>
          <Button
            colorPalette={currentPage === 0 ? "blue" : "gray"}
            onClick={() => {
              onPageChange(0);
            }}
            variant={currentPage === 0 ? "solid" : "ghost"}
          >
            1
          </Button>
          {leftRange > 1 && <Text>...</Text>}
        </>
      )}

      {Array.from(
        { length: rightRange - leftRange + 1 },
        (_, i) => leftRange + i,
      ).map((page) => (
        <Button
          colorPalette={currentPage === page ? "blue" : "gray"}
          key={page}
          onClick={() => {
            onPageChange(page);
          }}
          variant={currentPage === page ? "solid" : "ghost"}
        >
          {page + 1}
        </Button>
      ))}

      {showLast && (
        <>
          {rightRange < lastPageIndex - 1 && <Text>...</Text>}
          <Button
            colorPalette={currentPage === lastPageIndex ? "blue" : "gray"}
            onClick={() => {
              onPageChange(lastPageIndex);
            }}
            variant={currentPage === lastPageIndex ? "solid" : "ghost"}
          >
            {totalPages}
          </Button>
        </>
      )}

      <IconButton
        aria-label="Next page"
        disabled={currentPage >= lastPageIndex}
        onClick={() => {
          onPageChange(currentPage + 1);
        }}
        variant="ghost"
      >
        <FiChevronRight />
      </IconButton>
    </HStack>
  );
};
