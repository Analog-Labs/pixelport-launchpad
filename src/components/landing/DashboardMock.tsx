const DashboardMock = () => (
  <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-lg shadow-primary/5">
    <div className="flex items-center gap-2 mb-3 border-b border-border pb-3">
      <div className="w-2 h-2 rounded-full bg-emerald-500" />
      <span className="text-sm font-semibold text-foreground">Content Pipeline</span>
    </div>
    <div className="grid grid-cols-3 gap-2 mb-3">
      <div className="text-center">
        <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Drafts (3)</p>
        <div className="bg-surface rounded-lg p-2">
          <p className="text-[11px] text-foreground/80 truncate">Competitor teardown post</p>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[10px] font-semibold text-primary mb-1.5">In Review (2)</p>
        <div className="bg-surface rounded-lg p-2 border border-primary/20">
          <p className="text-[11px] text-foreground/80 truncate">LinkedIn carousel</p>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Published (8)</p>
        <div className="bg-surface rounded-lg p-2">
          <p className="text-[11px] text-foreground/80 truncate">X thread on AI ops</p>
        </div>
      </div>
    </div>
    <div className="border-t border-border pt-3">
      <p className="text-xs font-semibold text-foreground mb-2">Pending Approvals (2)</p>
      <div className="bg-surface rounded-lg p-3">
        <p className="text-xs text-muted-foreground mb-2">
          LinkedIn: <span className="text-foreground">"3 things competitors won't tell you..."</span>
        </p>
        <div className="flex gap-2">
          <button className="text-xs px-2.5 py-1 rounded bg-primary/15 text-primary border border-primary/30">✅ Approve</button>
          <button className="text-xs px-2.5 py-1 rounded bg-secondary text-secondary-foreground border border-border">✏️ Edit</button>
          <button className="text-xs px-2.5 py-1 rounded bg-secondary text-secondary-foreground border border-border">❌ Reject</button>
        </div>
      </div>
    </div>
  </div>
);

export default DashboardMock;
