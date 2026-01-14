import { Button, HStack, IconButton, Text } from "@chakra-ui/react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) => {
  const siblings = 1;
  const leftRange = Math.max(1, currentPage - siblings);
  const rightRange = Math.min(totalPages, currentPage + siblings);

  const showFirst = leftRange > 1;
  const showLast = rightRange < totalPages;

  return (
    <HStack gap={2} justify="center" mb={8} mt={8}>
      <IconButton
        aria-label="Previous page"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        variant="ghost"
      >
        <FiChevronLeft />
      </IconButton>

      {showFirst && (
        <>
          <Button
            colorPalette={currentPage === 1 ? "blue" : "gray"}
            onClick={() => onPageChange(1)}
            variant={currentPage === 1 ? "solid" : "ghost"}
          >
            1
          </Button>
          {leftRange > 2 && <Text>...</Text>}
        </>
      )}

      {Array.from(
        { length: rightRange - leftRange + 1 },
        (_, i) => leftRange + i,
      ).map((page) => (
        <Button
          colorPalette={currentPage === page ? "blue" : "gray"}
          key={page}
          onClick={() => onPageChange(page)}
          variant={currentPage === page ? "solid" : "ghost"}
        >
          {page}
        </Button>
      ))}

      {showLast && (
        <>
          {rightRange < totalPages - 1 && <Text>...</Text>}
          <Button
            colorPalette={currentPage === totalPages ? "blue" : "gray"}
            onClick={() => onPageChange(totalPages)}
            variant={currentPage === totalPages ? "solid" : "ghost"}
          >
            {totalPages}
          </Button>
        </>
      )}

      <IconButton
        aria-label="Next page"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        variant="ghost"
      >
        <FiChevronRight />
      </IconButton>
    </HStack>
  );
};
