import { Button } from "../../../components/actions/button.tsx";
import { Form } from "../../../components/form/form.tsx";
import css from "./create-tag-form.module.css";
import type { TagInput } from "../model/tag-types.ts";
import { tagInputFromForm } from "../model/tag-mappers.ts";

export function CreateTagForm({
  pending,
  onDirty,
  onCreate,
}: {
  pending: boolean;
  onDirty: () => void;
  onCreate: (input: TagInput, form: HTMLFormElement) => void;
}) {
  return (
    <Form
      className={css.createForm}
      onInput={onDirty}
      onSubmit={(event) => {
        event.preventDefault();
        onCreate(
          tagInputFromForm(new FormData(event.currentTarget)),
          event.currentTarget,
        );
      }}
    >
      <label>
        Slug<input name="slug" required autoComplete="off" />
      </label>
      <label>
        English Label<input name="english" required autoComplete="off" />
      </label>
      <label>
        Portuguese Label<input name="portuguese" required autoComplete="off" />
      </label>
      <label>
        Aliases, Comma Separated<input name="aliases" autoComplete="off" />
      </label>
      <Button
        type="submit"
        variant="primary"
        disabled={pending}
      >
        Add Canonical Tag
      </Button>
    </Form>
  );
}
