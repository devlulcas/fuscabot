import css from "./library-pagination.module.css";
import { Button } from "../../../components/actions/button.tsx";

export function LibraryPagination({
  currentPage,
  hasMore,
  onPageChange,
}: {
  currentPage: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav className={css.pagination} aria-label="Library pages">
      <Button
        type="button"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        Previous
      </Button>
      <span>Page {currentPage}</span>
      <Button
        type="button"
        disabled={!hasMore}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Next
      </Button>
    </nav>
  );
}
