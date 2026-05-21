import { X } from "lucide-react";

export function Modal({
  open, onClose, title, children, size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  if (!open) return null;
  const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-2xl w-full ${sizes[size]} max-h-[90vh] overflow-hidden flex flex-col shadow-2xl`}
        style={{ border: '1px solid rgba(45,75,82,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(45,75,82,0.1)', background: 'linear-gradient(135deg, var(--brand-cream2) 0%, #ffffff 100%)' }}>
          <h3 className="text-base font-bold" style={{ color: 'var(--brand-teal)' }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-stone-100 transition-colors" style={{ color: 'var(--brand-teal2)' }}>
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto" style={{ background: 'white' }}>{children}</div>
      </div>
    </div>
  );
}
