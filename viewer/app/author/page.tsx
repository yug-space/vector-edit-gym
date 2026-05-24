import { AuthorForm } from "./AuthorForm";

export const dynamic = "force-dynamic";

export default function AuthorPage() {
  return (
    <>
      <h1>Author a task</h1>
      <p className="muted" style={{ marginTop: -4, marginBottom: 16 }}>
        Pick a real icon or composite scene, choose what to corrupt, write a natural-language
        instruction. Live preview shows the broken initial vs. the clean target. Save to write
        <code style={{ margin: "0 4px" }}>data/tasks/&lt;task_id&gt;.json</code>.
      </p>
      <AuthorForm />
    </>
  );
}
