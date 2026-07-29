import { useCallback, useState } from "react";

const EMPTY_SELECTION = new Set<string>();

export function useLibrarySelection(scope: string) {
  const [selection, setSelection] = useState({
    scope,
    ids: new Set<string>(),
  });
  const selected = selection.scope === scope ? selection.ids : EMPTY_SELECTION;
  const replaceSelection = useCallback((ids: Set<string>) => {
    setSelection({ scope, ids });
  }, [scope]);
  const clearSelection = useCallback(() => {
    replaceSelection(new Set());
  }, [replaceSelection]);
  const toggle = useCallback((id: string, checked: boolean) => {
    setSelection((current) => {
      const ids: Set<string> = current.scope === scope
        ? new Set(current.ids)
        : new Set<string>();
      if (checked) ids.add(id);
      else ids.delete(id);
      return { scope, ids };
    });
  }, [scope]);
  return { selected, replaceSelection, clearSelection, toggle };
}
