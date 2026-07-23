import { Wrench } from "lucide-react";

export function SetupNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="setup-notice" role="note">
      <Wrench size={18} aria-hidden="true" />
      <div><strong>Starter mode</strong><p>{children}</p></div>
    </div>
  );
}
