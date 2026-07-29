import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  type LibraryFilters,
  librarySearchParams,
  parseLibrarySearch,
} from "../model/library-search.ts";

export function useLibrarySearch() {
  const [params, setParams] = useSearchParams();
  const filters = parseLibrarySearch(params);
  const scope = params.toString();
  const submit = useCallback((form: HTMLFormElement) => {
    const data = new FormData(form);
    setParams(librarySearchParams({
      q: stringValue(data, "q"),
      state: optionalEnum(data, "state", ["inbox", "read_later", "shared"]),
      visibility: optionalEnum(data, "visibility", ["public", "private"]),
      domain: stringValue(data, "domain") || undefined,
      enrichmentStatus: optionalEnum(data, "enrichmentStatus", [
        "preparing",
        "ready",
        "failed",
      ]),
      sort: optionalEnum(data, "sort", ["newest", "oldest", "updated"]) ??
        "newest",
      page: 1,
    }));
  }, [setParams]);
  const goToPage = useCallback((page: number) => {
    setParams(librarySearchParams({ ...filters, page }));
  }, [filters, setParams]);
  return { filters, params, scope, submit, goToPage };
}

function stringValue(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optionalEnum<T extends string>(
  data: FormData,
  name: string,
  values: readonly T[],
): T | undefined {
  const value = stringValue(data, name);
  return values.find((candidate) => candidate === value);
}

export type { LibraryFilters };
