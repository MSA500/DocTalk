import { useId, type ChangeEvent, type RefObject } from "react";

type HiddenFileInputProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function HiddenFileInput({ inputRef, onChange }: HiddenFileInputProps) {
  const inputId = useId();

  return (
    <>
      <label htmlFor={inputId} className="sr-only">
        Upload documents
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        className="sr-only"
        onChange={onChange}
      />
    </>
  );
}
