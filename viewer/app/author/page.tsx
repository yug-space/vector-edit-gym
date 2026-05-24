import { AuthorForm } from "./AuthorForm";

export const dynamic = "force-dynamic";

export default function AuthorPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Author a task</h1>
        <p className="mt-2 max-w-2xl text-[hsl(var(--muted-foreground))]">
          Pick a real icon or a composite scene, choose the corruption, write a natural-language instruction.
          The live preview shows the broken initial vs. the clean target. Save writes a JSON file to{" "}
          <code className="font-mono text-xs">data/tasks/&lt;task_id&gt;.json</code>.
        </p>
      </div>
      <AuthorForm />
    </section>
  );
}
