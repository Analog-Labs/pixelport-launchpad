const DashboardMock = () => (
  <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-lg shadow-primary/5">
    <div className="flex items-center gap-2 mb-3 border-b border-border pb-3">
      <div className="w-2 h-2 rounded-full bg-emerald-500" />
      <span className="text-sm font-semibold text-foreground">Luna</span>
      <span className="text-xs text-muted-foreground">Active · 2m ago</span>
    </div>
    <div className="space-y-1.5 mb-4 text-sm">
      <p className="text-muted-foreground">
        Current: <span className="text-foreground">Reviewing content draft</span>
      </p>
      <p className="text-muted-foreground">
        Next: <span className="text-foreground">Daily digest at 6:00 PM</span>
      </p>
      <p className="text-muted-foreground">
        Sub-agents: <span className="text-foreground">1 researching, 1 idle</span>
      </p>
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
