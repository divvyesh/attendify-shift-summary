import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Users } from 'lucide-react';
import { TeamKPICards } from '@/components/TeamKPICards';
import { FilterToolbar } from '@/components/FilterToolbar';
import { ManagerTable } from '@/components/ManagerTable';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useToast } from '@/hooks/use-toast';

export default function TeamDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { records, employees, clearData } = useAttendanceStore();

  useEffect(() => {
    if (records.length === 0) {
      // No data loaded, redirect to upload page
      navigate('/');
    }
  }, [records.length, navigate]);

  const handleUploadNew = () => {
    clearData();
    navigate('/');
    toast({
      title: "Data cleared",
      description: "Ready to upload new attendance files.",
    });
  };

  const handleExportCSV = () => {
    // Create CSV content from current employee data
    const headers = [
      'Employee Name',
      'Employee ID',
      'Store',
      'Worked Shifts',
      'Scheduled Shifts', 
      'Shift Attendance %',
      'Hours Worked',
      'Hours Scheduled',
      'Hours Attendance %',
      'Attendance %',
      'Tardy Count',
      'Early Out Count',
      'Present Count',
      'Absent Count'
    ];

    const csvRows = [
      headers.join(','),
      ...employees.map(emp => [
        `"${emp.employee_name}"`,
        emp.employee_code,
        `"${emp.store}"`,
        emp.worked_shifts,
        emp.scheduled_shifts,
        emp.shifts_attendance_pct.toFixed(1),
        emp.hours_worked.toFixed(2),
        emp.hours_scheduled.toFixed(2),
        emp.hours_attendance_pct.toFixed(1),
        emp.attendance_pct.toFixed(1),
        emp.tardy_count,
        emp.early_out_count,
        emp.present_count,
        emp.absent_count
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `team-attendance-summary-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "CSV exported",
      description: "Team attendance summary has been downloaded.",
    });
  };

  if (records.length === 0) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Attendance Summariser</h1>
            <p className="text-muted-foreground">
              Team dashboard showing attendance metrics for {employees.length} employees
            </p>
          </div>
          <Button onClick={handleUploadNew} variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Upload New Files
          </Button>
        </div>

        {/* Team KPI Cards */}
        <TeamKPICards />

        {/* Filters and Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <CardTitle>Team Members</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <FilterToolbar onExport={handleExportCSV} />
            <ManagerTable />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}