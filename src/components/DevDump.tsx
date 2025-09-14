import { useDebug } from "@/lib/debug-context";

export default function DevDump({ note, title = "Dev Dump" }: { note: any; title?: string }) {
  const { debug } = useDebug();
  if (!debug || !note) return null;
  return (
    <section className="card p-3 mt-3" data-testid="debug-dump">
      <div className="font-medium mb-2">{title}</div>
      <pre className="text-xs overflow-auto max-h-60">{JSON.stringify(note, null, 2)}</pre>
    </section>
  );
}