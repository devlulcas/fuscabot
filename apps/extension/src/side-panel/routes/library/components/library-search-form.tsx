import css from "./library-search-form.module.css";
import { Form } from "../../../components/form/form.tsx";
import { Button } from "../../../components/actions/button.tsx";
import type { LibraryFilters } from "../model/library-search.ts";

export function LibrarySearchForm({
  filters,
  formKey,
  onSubmit,
}: {
  filters: LibraryFilters;
  formKey: string;
  onSubmit: (form: HTMLFormElement) => void;
}) {
  return (
    <Form
      key={formKey}
      className={css.search}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(event.currentTarget);
      }}
    >
      <label>
        Search<input
          name="q"
          type="search"
          defaultValue={filters.q}
          autoComplete="off"
          placeholder="Title, URL, note, tag…"
        />
      </label>
      <label>
        State<select name="state" defaultValue={filters.state ?? ""}>
          <option value="">All States</option>
          <option value="inbox">Inbox</option>
          <option value="read_later">Read Later</option>
          <option value="shared">Shared</option>
        </select>
      </label>
      <label>
        Visibility<select
          name="visibility"
          defaultValue={filters.visibility ?? ""}
        >
          <option value="">All</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </label>
      <label>
        Domain<input
          name="domain"
          defaultValue={filters.domain}
          autoComplete="off"
          placeholder="example.com…"
        />
      </label>
      <label>
        AI Status<select
          name="enrichmentStatus"
          defaultValue={filters.enrichmentStatus ?? ""}
        >
          <option value="">Any</option>
          <option value="failed">Failed</option>
          <option value="preparing">Preparing</option>
          <option value="ready">Ready</option>
        </select>
      </label>
      <label>
        Sort<select name="sort" defaultValue={filters.sort}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="updated">Recently Updated</option>
        </select>
      </label>
      <Button type="submit">Apply Filters</Button>
    </Form>
  );
}
