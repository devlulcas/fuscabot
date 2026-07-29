import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { createManualCaptureMutationOptions } from "../api/captures.mutations.ts";

export function useManualCapture() {
  const navigate = useNavigate();
  const [dirty, setDirty] = useState(false);
  const mutation = useMutation(createManualCaptureMutationOptions());
  const submit = useCallback((form: FormData) => {
    mutation.mutate(form, {
      onSuccess: (captureId) => {
        setDirty(false);
        navigate(`/capture/${captureId}`);
      },
    });
  }, [mutation, navigate]);
  return { dirty, setDirty, mutation, submit };
}
