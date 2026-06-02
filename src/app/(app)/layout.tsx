import BottomNav from "@/components/shared/BottomNav";

// Shell for the authenticated app (4 tabs + FAB).
// The (app) route group shares this frame + bottom nav.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-frame atmos-scanlines">
      <div className="statusbar">
        <span>9:41</span>
        <span className="sb-dots">● ● ● ●</span>
        <span>100%</span>
      </div>
      {children}
      <BottomNav />
    </div>
  );
}
