import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Users,
  Timer,
  UserCheck
} from 'lucide-react';

interface SummaryProps {
  summary: {
    scheduled_shifts: number;
    shifts_worked: number;
    attendance_pct_shifts: number;
    scheduled_hours: number;
    worked_hours: number;
    attendance_pct_hours: number;
    tardy_count: number;
    early_dismissal_count: number;
  };
}

export const SummaryCards = ({ summary }: SummaryProps) => {
  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 95) return 'text-success';
    if (percentage >= 85) return 'text-warning';
    return 'text-destructive';
  };

  const getAttendanceBadge = (percentage: number) => {
    if (percentage >= 95) return 'default';
    if (percentage >= 85) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Shifts Attendance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Shifts Attendance</CardTitle>
          <UserCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-2xl font-bold">
              {summary.shifts_worked}/{summary.scheduled_shifts}
            </div>
            <Badge 
              variant={getAttendanceBadge(summary.attendance_pct_shifts)}
              className="text-xs"
            >
              {summary.attendance_pct_shifts.toFixed(1)}%
            </Badge>
            <p className="text-xs text-muted-foreground">
              Shifts worked vs scheduled
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Hours Attendance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Hours Attendance</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-2xl font-bold">
              {summary.worked_hours.toFixed(1)}h
            </div>
            <Badge 
              variant={getAttendanceBadge(summary.attendance_pct_hours)}
              className="text-xs"
            >
              {summary.attendance_pct_hours.toFixed(1)}%
            </Badge>
            <p className="text-xs text-muted-foreground">
              of {summary.scheduled_hours.toFixed(1)}h scheduled
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tardiness */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tardiness</CardTitle>
          <Timer className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-warning">
              {summary.tardy_count}
            </div>
            <Badge variant="outline" className="text-xs">
              {summary.shifts_worked > 0 
                ? ((summary.tardy_count / summary.shifts_worked) * 100).toFixed(1)
                : 0}% of worked shifts
            </Badge>
            <p className="text-xs text-muted-foreground">
              Late arrivals (&gt;5 min)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Early Dismissals */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Early Dismissals</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-destructive">
              {summary.early_dismissal_count}
            </div>
            <Badge variant="outline" className="text-xs">
              {summary.shifts_worked > 0 
                ? ((summary.early_dismissal_count / summary.shifts_worked) * 100).toFixed(1)
                : '0'}% of worked shifts
            </Badge>
            <p className="text-xs text-muted-foreground">
              Early departures (&gt;15 min)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};