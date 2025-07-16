import { useState } from 'react';
import { FileUploader } from '@/components/FileUploader';
import { SummaryCards } from '@/components/SummaryCards';
import { DayTable } from '@/components/DayTable';
import { ConfigPanel } from '@/components/ConfigPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileSpreadsheet, Calculator } from 'lucide-react';

interface AttendanceData {
  employee_name: string;
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
  day_level: Array<{
    date: string;
    shift_type: string;
    sched_start_dt: string;
    sched_end_dt: string;
    actual_in: string | null;
    actual_out: string | null;
    actual_out1: string | null;
    actual_in2: string | null;
    sched_minutes: number;
    worked_minutes: number;
    worked_minutes_clipped: number;
    attendance_fraction: number;
    present: boolean;
    tardy: boolean;
    early_dismissal: boolean;
  }>;
  config_used: any;
}

const Index = () => {
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleDataProcessed = (data: AttendanceData) => {
    setAttendanceData(data);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Calculator className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Attendance Summariser</h1>
              <p className="text-muted-foreground">Process employee attendance data from Excel files</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {!attendanceData ? (
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Upload Attendance Files
                </CardTitle>
                <CardDescription>
                  Upload your punch clock data and schedule files to generate detailed attendance analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="upload" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upload">File Upload</TabsTrigger>
                    <TabsTrigger value="config">Configuration</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="upload" className="mt-6">
                    <FileUploader 
                      onDataProcessed={handleDataProcessed}
                      isLoading={isLoading}
                      setIsLoading={setIsLoading}
                    />
                  </TabsContent>
                  
                  <TabsContent value="config" className="mt-6">
                    <ConfigPanel />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Employee Header */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">
                  Attendance Analysis: {attendanceData.employee_name || 'Unknown Employee'}
                </CardTitle>
                <CardDescription>
                  Analysis period covers {attendanceData.day_level.length} scheduled shifts
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Summary Cards */}
            <SummaryCards summary={attendanceData.summary} />

            {/* Day Level Table */}
            <DayTable 
              dayRecords={attendanceData.day_level}
              employeeName={attendanceData.employee_name}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
