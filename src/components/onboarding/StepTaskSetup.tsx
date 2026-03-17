import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, CheckSquare, Plus, Trash2 } from "lucide-react";

export interface AgentSuggestionInput {
  id: string;
  role: string;
  name: string;
  focus: string;
}

interface Props {
  companyName: string;
  starterTask: string;
  suggestions: AgentSuggestionInput[];
  onStarterTaskChange: (value: string) => void;
  onSuggestionChange: (id: string, patch: Partial<AgentSuggestionInput>) => void;
  onAddSuggestion: () => void;
  onRemoveSuggestion: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}

const StepTaskSetup = ({
  companyName,
  starterTask,
  suggestions,
  onStarterTaskChange,
  onSuggestionChange,
  onAddSuggestion,
  onRemoveSuggestion,
  onBack,
  onNext,
}: Props) => {
  const canContinue = starterTask.trim().length >= 6 && suggestions.length >= 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <CheckSquare className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Task and team setup</h2>
          <p className="text-sm text-muted-foreground">
            We seeded a starter plan for {companyName || "your company"}. Everything is editable.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="starter_task">Starter task</Label>
        <Textarea
          id="starter_task"
          value={starterTask}
          onChange={(event) => onStarterTaskChange(event.target.value)}
          className="bg-[hsl(240_14%_6%)] border-border focus-visible:ring-primary min-h-[110px]"
          maxLength={500}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Agent suggestions</Label>
          <Button type="button" variant="outline" size="sm" onClick={onAddSuggestion}>
            <Plus className="mr-1 h-4 w-4" />
            Add agent
          </Button>
        </div>
        <div className="space-y-3">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="rounded-lg border border-[hsl(240_10%_20%)] bg-[hsl(240_14%_8%)] p-4 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`agent-role-${suggestion.id}`}>Role</Label>
                  <Input
                    id={`agent-role-${suggestion.id}`}
                    value={suggestion.role}
                    onChange={(event) => onSuggestionChange(suggestion.id, { role: event.target.value })}
                    className="bg-[hsl(240_14%_6%)] border-border focus-visible:ring-primary"
                    maxLength={80}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`agent-name-${suggestion.id}`}>Name</Label>
                  <Input
                    id={`agent-name-${suggestion.id}`}
                    value={suggestion.name}
                    onChange={(event) => onSuggestionChange(suggestion.id, { name: event.target.value })}
                    className="bg-[hsl(240_14%_6%)] border-border focus-visible:ring-primary"
                    maxLength={80}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`agent-focus-${suggestion.id}`}>Focus</Label>
                <Textarea
                  id={`agent-focus-${suggestion.id}`}
                  value={suggestion.focus}
                  onChange={(event) => onSuggestionChange(suggestion.id, { focus: event.target.value })}
                  className="bg-[hsl(240_14%_6%)] border-border focus-visible:ring-primary min-h-[80px]"
                  maxLength={200}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onRemoveSuggestion(suggestion.id)}
                  disabled={suggestions.length <= 1}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} className="text-muted-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button className="flex-1 shimmer-btn text-primary-foreground font-semibold" onClick={onNext} disabled={!canContinue}>
          Continue to Launch <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default StepTaskSetup;
