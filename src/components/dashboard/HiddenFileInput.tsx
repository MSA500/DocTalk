import { useId, type ChangeEvent, type RefObject } from "react";

type HiddenFileInputProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

const ACCEPTED_FILE_TYPES = ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

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
        accept={ACCEPTED_FILE_TYPES}
        className="sr-only"
        onChange={onChange}
      />
    </>
  );
}
