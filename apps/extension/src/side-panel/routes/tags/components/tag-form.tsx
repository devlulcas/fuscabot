import type { CanonicalTag } from "../../../../shared/api.ts";
import { Actions } from "../../../components/actions/actions.tsx";
import { Button } from "../../../components/actions/button.tsx";
import { Card } from "../../../components/layout/card.tsx";
import { Form } from "../../../components/form/form.tsx";
import css from "./tag-form.module.css";
import type { TagInput } from "../model/tag-types.ts";
import { tagInputFromForm } from "../model/tag-mappers.ts";

export function TagForm({
  tag,
  tags,
  pending,
  onDirty,
  onSave,
  onMerge,
}: {
  tag: CanonicalTag;
  tags: CanonicalTag[];
  pending: boolean;
  onDirty: () => void;
  onSave: (input: TagInput) => void;
  onMerge: (target: string) => void;
}) {
  const english = tag.labels.find((label) => label.language === "en")?.name ??
    tag.slug;
  const portuguese =
    tag.labels.find((label) => label.language === "pt-BR")?.name ?? tag.slug;
  return (
    <Card as="section" className={css.tagForm}>
      <Form
        onInput={onDirty}
        onSubmit={(event) => {
          event.preventDefault();
          const submitter = (event.nativeEvent as SubmitEvent).submitter as
            | HTMLButtonElement
            | null;
          const data = new FormData(event.currentTarget);
          if (submitter?.value === "merge") {
            const target = data.get("targetId");
            if (typeof target === "string" && target) onMerge(target);
            return;
          }
          onSave(tagInputFromForm(data));
        }}
      >
        <label>
          Slug<input name="slug" defaultValue={tag.slug} required />
        </label>
        <label>
          English<input name="english" defaultValue={english} required />
        </label>
        <label>
          Portuguese<input
            name="portuguese"
            defaultValue={portuguese}
            required
          />
        </label>
        <label>
          Aliases<input name="aliases" defaultValue={tag.aliases.join(", ")} />
        </label>
        <Actions>
          <Button type="submit" disabled={pending} value="save">
            Save Tag
          </Button>
          <select aria-label={`Merge ${tag.slug} into`} name="targetId">
            <option value="">Merge Into…</option>
            {tags.filter((target) => target.id !== tag.id).map((target) => (
              <option key={target.id} value={target.id}>#{target.slug}</option>
            ))}
          </select>
          <Button
            type="submit"
            variant="danger"
            disabled={pending}
            value="merge"
          >
            Merge
          </Button>
        </Actions>
      </Form>
    </Card>
  );
}
