import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Download } from 'lucide-react';
import { SummaryCards } from '@/components/SummaryCards';
import { DayTable } from '@/components/DayTable';
import { FilterToolbar } from '@/components/FilterToolbar';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useToast } from '@/hooks/use-toast';

export default function EmployeeProfile() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { employees, getEmployeeRecords, getFilteredRecords } = useAttendanceStore();
  
  const [employee, setEmployee] = useState<any>(null);
  const [employeeRecords, setEmployeeRecords] = useState<any[]>([]);

  useEffect(() => {
    if (!employeeId) {
      navigate('/team');
      return;
    }

    const emp = employees.find(e => e.employee_id === employeeId);
    if (!emp) {
      toast({
        title: "Employee not found",
        description: "The requested employee profile could not be found.",
        variant: "destructive",
      });
      navigate('/team');
      return;
    }

    setEmployee(emp);
    
    // Get employee records and convert to expected format for existing components
    const records = getEmployeeRecords(employeeId);
    const formattedRecords = records.map(record => ({
      date: record.date,
      shift_type: record.shift,
      sched_start_dt: record.scheduled_in,
      sched_end_dt: record.scheduled_out,
      actual_in: record.actual_in,
      actual_out: record.actual_out,
      actual_out1: null,
      actual_in2: null,
      sched_minutes: record.scheduled_hours * 60,
      worked_minutes: record.hours_worked * 60,
      worked_minutes_clipped: record.hours_worked * 60,
      attendance_fraction: record.attendance_pct / 100,
      present: record.status === 'Present' || record.status === 'Late' || record.status === 'Early-out',
      tardy: record.is_tardy,
      early_dismissal: record.is_early_out,
    }));
    
    setEmployeeRecords(formattedRecords);
  }, [employeeId, employees, getEmployeeRecords, navigate, toast]);

  const handleExportCSV = () => {
    if (!employee || employeeRecords.length === 0) return;

    const headers = [
      'Date',
      'Shift',
      'Scheduled In',
      'Scheduled Out',
      'Actual In',
      'Actual Out',
      'Scheduled Hours',
      'Hours Worked',
      'Attendance %',
      'Status',
      'Tardy',
      'Early Out'
    ];

    const records = getEmployeeRecords(employeeId!);
    const csvRows = [
      headers.join(','),
      ...records.map(record => [
        record.date,
        record.shift,
        record.scheduled_in,
        record.scheduled_out,
        record.actual_in || '',
        record.actual_out || '',
        record.scheduled_hours.toFixed(2),
        record.hours_worked.toFixed(2),
        record.attendance_pct.toFixed(1),
        record.status,
        record.is_tardy ? 'Yes' : 'No',
        record.is_early_out ? 'Yes' : 'No'
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${employee.employee_name.replace(/\s+/g, '-').toLowerCase()}-attendance-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "CSV exported",
      description: `${employee.employee_name}'s attendance records have been downloaded.`,
    });
  };

  if (!employee) {
    return null;
  }

  // Convert employee summary to expected format for SummaryCards
  const summaryData = {
    employee_name: employee.employee_name,
    summary: {
      scheduled_shifts: employee.scheduled_shifts,
      shifts_worked: employee.worked_shifts,
      attendance_pct_shifts: employee.shifts_attendance_pct,
      scheduled_hours: employee.hours_scheduled,
      worked_hours: employee.hours_worked,
      attendance_pct_hours: employee.hours_attendance_pct,
      tardy_count: employee.tardy_count,
      early_dismissal_count: employee.early_out_count,
    },
    day_level: employeeRecords,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/team')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Team
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Attendance Analysis: {employee.employee_name}
              </h1>
              <p className="text-muted-foreground">
                Analysis period covers {employee.scheduled_shifts} scheduled shifts at {employee.store}
              </p>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <SummaryCards summary={summaryData.summary} />

        {/* Day-Level Records */}
        <Card>
          <CardHeader>
            <CardTitle>Day-Level Attendance Records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FilterToolbar 
              showExport={true} 
              onExport={handleExportCSV} 
            />
            <DayTable dayRecords={employeeRecords} employeeName={employee.employee_name} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}