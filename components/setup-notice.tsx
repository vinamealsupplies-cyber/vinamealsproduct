import { Wrench } from "lucide-react";

export function SetupNotice({ title = "Starter mode", children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="setup-notice" role="note">
      <Wrench size={18} aria-hidden="true" />
      <div><strong>{title}</strong><p>{children}</p></div>
    </div>
  );
}
