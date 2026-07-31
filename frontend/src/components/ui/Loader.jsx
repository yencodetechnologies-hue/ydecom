export default function Loader({ label = 'Loading...' }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-rose-deep">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-rose-soft border-t-rose" />
      <p className="text-sm text-ink/70">{label}</p>
    </div>
  );
}
