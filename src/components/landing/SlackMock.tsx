const SlackMock = () => (
  <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-lg shadow-primary/5">
    <div className="flex items-center gap-2 mb-3 border-b border-border pb-3">
      <div className="w-2 h-2 rounded-full bg-emerald-500" />
      <span className="text-sm font-semibold text-foreground">Luna (Chief of Staff)</span>
      <span className="text-xs text-muted-foreground ml-auto">2m ago</span>
    </div>
    <div className="bg-surface rounded-lg p-3 mb-3">
      <p className="text-sm text-foreground/90 font-mono leading-relaxed">
        "Morning! I spotted 3 competitor moves overnight.{" "}
        <br className="hidden sm:block" />
        I've drafted counter-content — 2 LinkedIn posts{" "}
        <br className="hidden sm:block" />
        and a thread for X. Ready for your review 👇"
      </p>
    </div>
    <div className="flex gap-2 flex-wrap">
      <button className="text-xs px-3 py-1.5 rounded-md bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors">
        ✅ Approve
      </button>
      <button className="text-xs px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground border border-border hover:border-primary/30 transition-colors">
        ✏️ Edit
      </button>
      <button className="text-xs px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground border border-border hover:border-primary/30 transition-colors">
        🔄 New Angle
      </button>
    </div>
  </div>
);

export default SlackMock;
