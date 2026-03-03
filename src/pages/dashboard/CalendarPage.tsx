import { Calendar } from "lucide-react";
import EmptyState from "@/components/dashboard/EmptyState";

const CalendarPage = () => (
  <EmptyState
    icon={Calendar}
    heading="Content Calendar"
    description="A visual calendar of your scheduled and published content. Start creating content to populate your calendar."
  />
);

export default CalendarPage;
