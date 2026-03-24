import { Button } from '@/components/ui/button';

export function AgentInvokeButton({
  label,
  onClick,
  pending = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  pending?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      size="sm"
      onClick={onClick}
      disabled={pending || disabled}
      className="min-h-[40px] sm:min-h-0"
    >
      {pending ? 'Running...' : label}
    </Button>
  );
}
