interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function FileLoader({ onFile, disabled }: Props) {
  return (
    <label className="file-loader">
      <span>ファイルを選択</span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </label>
  );
}
