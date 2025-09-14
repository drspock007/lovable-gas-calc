import { useDebug } from "@/lib/debug-context";

export default function DevPanel() {
  const { debug, setDebug } = useDebug();
  return (
    <section className="card p-4">
      <div className="flex items-center justify-between">
        <div className="font-medium">Debug Mode</div>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={debug}
            onChange={e => setDebug(e.target.checked)}
          />
          <span>{debug ? "ON" : "OFF"}</span>
        </label>
      </div>
      <p className="text-xs opacity-70 mt-1">
        Persiste dans localStorage. Affiche les blocs Dev et logs utiles.
      </p>
    </section>
  );
}