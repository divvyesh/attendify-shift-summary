import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useAttendanceStore } from '@/store/attendanceStore';

type SortField = 'name' | 'shifts' | 'hours' | 'attendance' | 'tardy' | 'earlyOut';
type SortDirection = 'asc' | 'desc' | null;

export const ManagerTable = () => {
  const navigate = useNavigate();
  const { employees } = useAttendanceStore();
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedEmployees = useMemo(() => {
    if (!sortField || !sortDirection) return employees;

    return [...employees].sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortField) {
        case 'name':
          aValue = a.employee_name.toLowerCase();
          bValue = b.employee_name.toLowerCase();
          break;
        case 'shifts':
          aValue = a.shifts_attendance_pct;
          bValue = b.shifts_attendance_pct;
          break;
        case 'hours':
          aValue = a.hours_attendance_pct;
          bValue = b.hours_attendance_pct;
          break;
        case 'attendance':
          aValue = a.attendance_pct;
          bValue = b.attendance_pct;
          break;
        case 'tardy':
          aValue = a.tardy_count;
          bValue = b.tardy_count;
          break;
        case 'earlyOut':
          aValue = a.early_out_count;
          bValue = b.early_out_count;
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      const numA = aValue as number;
      const numB = bValue as number;
      return sortDirection === 'asc' ? numA - numB : numB - numA;
    });
  }, [employees, sortField, sortDirection]);

  const getAttendanceBadgeVariant = (percentage: number) => {
    if (percentage >= 95) return 'default';
    if (percentage >= 90) return 'secondary';
    return 'destructive';
  };

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 95) return 'text-success';
    if (percentage >= 90) return 'text-warning';
    return 'text-destructive';
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="ml-2 h-4 w-4" />;
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="ml-2 h-4 w-4" />;
    }
    return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
  };

  const handleViewProfile = (employeeId: string) => {
    navigate(`/team/${employeeId}`);
  };

  if (employees.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No employee data available.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center">
                Budtender
                {getSortIcon('name')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 text-center"
              onClick={() => handleSort('shifts')}
            >
              <div className="flex items-center justify-center">
                Shifts
                {getSortIcon('shifts')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 text-center"
              onClick={() => handleSort('hours')}
            >
              <div className="flex items-center justify-center">
                Hours
                {getSortIcon('hours')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 text-center"
              onClick={() => handleSort('attendance')}
            >
              <div className="flex items-center justify-center">
                Attendance %
                {getSortIcon('attendance')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 text-center"
              onClick={() => handleSort('tardy')}
            >
              <div className="flex items-center justify-center">
                Tardy
                {getSortIcon('tardy')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50 text-center"
              onClick={() => handleSort('earlyOut')}
            >
              <div className="flex items-center justify-center">
                Early-out
                {getSortIcon('earlyOut')}
              </div>
            </TableHead>
            <TableHead className="text-center">Status Mix</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedEmployees.map((employee) => (
            <TableRow key={employee.employee_id} className="hover:bg-muted/50">
              <TableCell>
                <div className="space-y-1">
                  <div 
                    className="font-medium cursor-pointer hover:text-primary"
                    onClick={() => handleViewProfile(employee.employee_id)}
                  >
                    {employee.employee_name}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {employee.store}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="space-y-1">
                  <div className="text-sm font-medium">
                    {employee.worked_shifts}/{employee.scheduled_shifts}
                  </div>
                  <Badge 
                    variant={getAttendanceBadgeVariant(employee.shifts_attendance_pct)} 
                    className="text-xs"
                  >
                    {employee.shifts_attendance_pct.toFixed(1)}%
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="space-y-1">
                  <div className="text-sm font-medium">
                    {employee.hours_worked.toFixed(1)}h / {employee.hours_scheduled.toFixed(1)}h
                  </div>
                  <Badge 
                    variant={getAttendanceBadgeVariant(employee.hours_attendance_pct)} 
                    className="text-xs"
                  >
                    {employee.hours_attendance_pct.toFixed(1)}%
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className={`text-lg font-bold ${getAttendanceColor(employee.attendance_pct)}`}>
                  {employee.attendance_pct.toFixed(1)}%
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="text-lg font-medium text-warning">
                  {employee.tardy_count}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="text-lg font-medium text-destructive">
                  {employee.early_out_count}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex flex-wrap gap-1 justify-center">
                  {employee.present_count > 0 && (
                    <Badge variant="default" className="text-xs bg-primary">
                      Present: {employee.present_count}
                    </Badge>
                  )}
                  {employee.absent_count > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      Absent: {employee.absent_count}
                    </Badge>
                  )}
                  {employee.late_count > 0 && (
                    <Badge variant="outline" className="text-xs border-warning text-warning">
                      Late: {employee.late_count}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewProfile(employee.employee_id)}
                >
                  <Eye className="mr-2 h-3 w-3" />
                  View Profile
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};