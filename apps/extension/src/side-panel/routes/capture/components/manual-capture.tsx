import { UnsavedChanges } from "../../../components/unsaved-changes/unsaved-changes.tsx";
import { InlineNotice } from "../../../components/page-status/page-status.tsx";
import { Button } from "../../../components/actions/button.tsx";
import { Form } from "../../../components/form/form.tsx";
import { Eyebrow } from "../../../components/typography/eyebrow.tsx";
import { PageStack } from "../../../components/layout/page-stack.tsx";
import { useManualCapture } from "../hooks/use-manual-capture.ts";

export function ManualCapture({ fallback = {}, error }: {
  fallback?: { url?: string; title?: string; selectedQuote?: string };
  error?: string;
}) {
  const { dirty, setDirty, mutation, submit } = useManualCapture();
  return (
    <PageStack>
      <Eyebrow>Fallback</Eyebrow>
      <h1>Capture Manually</h1>
      {error ? <InlineNotice error>{error}</InlineNotice> : null}
      <Form
        onInput={() => setDirty(true)}
        onSubmit={(event) => {
          event.preventDefault();
          submit(new FormData(event.currentTarget));
        }}
      >
        <label>
          URL<input
            name="url"
            type="url"
            required
            autoComplete="off"
            defaultValue={fallback.url}
            placeholder="https://example.com/…"
          />
        </label>
        <label>
          Title<input
            name="title"
            required
            autoComplete="off"
            defaultValue={fallback.title}
          />
        </label>
        <label>
          Selected Quote<textarea
            name="selectedQuote"
            defaultValue={fallback.selectedQuote}
          />
        </label>
        {mutation.error
          ? <InlineNotice error>{mutation.error.message}</InlineNotice>
          : null}
        <Button
          type="submit"
          variant="primary"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Saving…" : "Save Capture"}
        </Button>
      </Form>
      <UnsavedChanges when={dirty && !mutation.isPending} />
    </PageStack>
  );
}
