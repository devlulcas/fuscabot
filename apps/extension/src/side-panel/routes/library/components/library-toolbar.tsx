import css from "./library-toolbar.module.css";
import { Actions } from "../../../components/actions/actions.tsx";
import { Button } from "../../../components/actions/button.tsx";
import { Card } from "../../../components/layout/card.tsx";
import { Muted } from "../../../components/typography/muted.tsx";

export function LibraryToolbar({
  count,
  allSelected,
  disabled,
  onSelectAll,
  onDelete,
}: {
  count: number;
  allSelected: boolean;
  disabled: boolean;
  onSelectAll: (checked: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <Card className={css.toolbar}>
      <label className={css.selectAll}>
        <input
          type="checkbox"
          aria-label="Select all resources on this page"
          checked={allSelected}
          disabled={disabled}
          onChange={(event) => onSelectAll(event.target.checked)}
        />{" "}
        Select All
      </label>
      <Muted as="span">{count} selected</Muted>
      <Actions className={css.toolbarActions}>
        <Button
          type="button"
          disabled={!count || disabled}
          variant="danger"
          onClick={onDelete}
        >
          Delete Selected
        </Button>
      </Actions>
    </Card>
  );
}
