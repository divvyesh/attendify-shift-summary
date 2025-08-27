import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { useAttendanceStore } from '@/store/attendanceStore';

export const TeamKPICards = () => {
  const { teamKPIs } = useAttendanceStore();

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 95) return 'text-success';
    if (percentage >= 90) return 'text-warning';
    return 'text-destructive';
  };

  const getAttendanceBadgeVariant = (percentage: number) => {
    if (percentage >= 95) return 'default';
    if (percentage >= 90) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Shifts Attendance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Shifts Attendance</CardTitle>
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <div className="text-2xl font-bold">
              {teamKPIs.total_worked_shifts}/{teamKPIs.total_scheduled_shifts}
            </div>
            <Badge variant={getAttendanceBadgeVariant(teamKPIs.shifts_attendance_pct)}>
              {teamKPIs.shifts_attendance_pct.toFixed(1)}%
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Shifts worked vs scheduled
          </p>
        </CardContent>
      </Card>

      {/* Total Hours Attendance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Hours Attendance</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className={`text-2xl font-bold ${getAttendanceColor(teamKPIs.hours_attendance_pct)}`}>
              {teamKPIs.total_hours_worked.toFixed(1)}h
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">
                of {teamKPIs.total_hours_scheduled.toFixed(1)}h
              </span>
              <Badge variant={getAttendanceBadgeVariant(teamKPIs.hours_attendance_pct)}>
                {teamKPIs.hours_attendance_pct.toFixed(1)}%
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tardiness */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tardiness</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-warning">
              {teamKPIs.total_tardy_count}
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">
                {teamKPIs.tardiness_pct.toFixed(1)}% of worked shifts
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Early Dismissals */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Early Dismissals</CardTitle>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-destructive">
              {teamKPIs.total_early_out_count}
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">
                {teamKPIs.early_dismissal_pct.toFixed(1)}% of worked shifts
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};