export function Campo({
  label,
  htmlFor,
  erro,
  children,
}: {
  label: string;
  htmlFor: string;
  erro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {erro && <span className="text-sm text-red-600">{erro}</span>}
    </div>
  );
}
