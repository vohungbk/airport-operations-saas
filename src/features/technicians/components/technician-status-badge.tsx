import { Badge } from "@/components/ui/badge";

interface TechnicianStatusBadgeProps {
  is_active: boolean;
}

export function TechnicianStatusBadge({ is_active }: TechnicianStatusBadgeProps) {
  return (
    <Badge variant={is_active ? "success" : "muted"}>
      {is_active ? "Active" : "Inactive"}
    </Badge>
  );
}
