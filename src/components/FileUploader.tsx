import { useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FileUploaderProps {
  onDataProcessed: (data: any) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

interface UploadedFile {
  file: File;
  status: 'ready' | 'uploading' | 'success' | 'error';
}

export const FileUploader = ({ onDataProcessed, isLoading, setIsLoading }: FileUploaderProps) => {
  const [punchFile, setPunchFile] = useState<UploadedFile | null>(null);
  const [scheduleFile, setScheduleFile] = useState<UploadedFile | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  const punchFileRef = useRef<HTMLInputElement>(null);
  const scheduleFileRef = useRef<HTMLInputElement>(null);

  const handlePunchFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (validateFile(file)) {
        setPunchFile({ file, status: 'ready' });
        setError(null);
      }
    }
  };

  const handleScheduleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (validateFile(file)) {
        setScheduleFile({ file, status: 'ready' });
        setError(null);
      }
    }
  };

  const validateFile = (file: File): boolean => {
    const validExtensions = ['.xlsx', '.xls'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      setError(`Invalid file type. Please upload .xlsx or .xls files only.`);
      return false;
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      setError('File size too large. Maximum size is 50MB.');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!punchFile || !scheduleFile) {
      setError('Please upload both punch clock and schedule files');
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('punch_file', punchFile.file);
      formData.append('schedule_file', scheduleFile.file);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      let response;
      
      try {
        // Try to connect to backend first
        response = await fetch('http://localhost:8000/attendance/compute', {
          method: 'POST',
          body: formData,
          headers: {
            // Don't set Content-Type, let browser set it with boundary for FormData
          },
        });
      } catch (networkError) {
        // If backend is not available, use mock data for demo
        console.log('Backend not available, using mock data for demonstration');
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const mockData = {
          employee_name: "DOE, JANE",
          summary: {
            scheduled_shifts: 20,
            shifts_worked: 18,
            attendance_pct_shifts: 90.0,
            scheduled_hours: 135.0,
            worked_hours: 128.5,
            attendance_pct_hours: 95.2,
            tardy_count: 3,
            early_dismissal_count: 1
          },
          day_level: [
            {
              date: "2025-01-01",
              shift_type: "AM",
              sched_start_dt: "2025-01-01T09:45:00",
              sched_end_dt: "2025-01-01T16:30:00",
              actual_in: "2025-01-01T09:47:00",
              actual_out: "2025-01-01T16:30:00",
              actual_out1: "2025-01-01T12:00:00",
              actual_in2: "2025-01-01T12:30:00",
              sched_minutes: 405.0,
              worked_minutes: 373.0,
              worked_minutes_clipped: 373.0,
              attendance_fraction: 0.921,
              present: true,
              tardy: true,
              early_dismissal: false
            },
            {
              date: "2025-01-02",
              shift_type: "AM",
              sched_start_dt: "2025-01-02T09:45:00",
              sched_end_dt: "2025-01-02T16:30:00",
              actual_in: null,
              actual_out: null,
              actual_out1: null,
              actual_in2: null,
              sched_minutes: 405.0,
              worked_minutes: 0.0,
              worked_minutes_clipped: 0.0,
              attendance_fraction: 0.0,
              present: false,
              tardy: false,
              early_dismissal: false
            },
            {
              date: "2025-01-03",
              shift_type: "PM",
              sched_start_dt: "2025-01-03T16:00:00",
              sched_end_dt: "2025-01-04T00:15:00",
              actual_in: "2025-01-03T15:55:00",
              actual_out: "2025-01-04T00:15:00",
              actual_out1: "2025-01-03T20:00:00",
              actual_in2: "2025-01-03T20:30:00",
              sched_minutes: 495.0,
              worked_minutes: 465.0,
              worked_minutes_clipped: 465.0,
              attendance_fraction: 0.939,
              present: true,
              tardy: false,
              early_dismissal: false
            }
          ],
          config_used: {
            am: { start: "09:45", end: "16:30", cross_midnight: false },
            pm: { start: "16:00", end: "00:15", cross_midnight: true },
            tardy_minutes: 5,
            early_minutes: 15,
            timezone: "America/New_York"
          }
        };
        
        clearInterval(progressInterval);
        setProgress(100);
        
        onDataProcessed(mockData);
        
        toast({
          title: "⚠️ Demo Mode Active",
          description: "Backend server not running. Start with: cd backend && uvicorn app:app --reload --port 8000",
          variant: "destructive",
        });
        
        setError("Backend not running - showing sample data only. To process real files, start the Python server: cd backend && uvicorn app:app --reload --port 8000");
        
        return;
      }

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        let errorMessage = 'Failed to process files';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          errorMessage = `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      onDataProcessed(data);
      
      toast({
        title: "Files processed successfully!",
        description: `Analysis complete for ${data.employee_name || 'employee'}`,
      });

    } catch (err) {
      console.error('Upload error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during file upload';
      setError(errorMessage);
      toast({
        title: "Processing failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="font-medium mb-2">Punch Clock Data</h3>
          <Card className="h-32">
            <CardContent className="p-0 h-full">
              <div
                onClick={() => punchFileRef.current?.click()}
                className={`
                  h-full p-6 border-2 border-dashed rounded-lg cursor-pointer
                  transition-colors duration-200 flex flex-col items-center justify-center gap-2
                  ${punchFile ? 'border-success bg-success/5' : 'border-border hover:border-primary hover:bg-primary/5'}
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <input
                  ref={punchFileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handlePunchFileChange}
                  disabled={isLoading}
                  className="hidden"
                />
                
                {punchFile ? (
                  <>
                    <CheckCircle className="h-6 w-6 text-success" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-success">{punchFile.file.name}</p>
                      <p className="text-xs text-muted-foreground">Ready to process</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPunchFile(null);
                        if (punchFileRef.current) punchFileRef.current.value = '';
                      }}
                      className="mt-1"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-sm font-medium">Upload punch clock file</p>
                      <p className="text-xs text-muted-foreground">Excel file with Daily Hours Reports</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div>
          <h3 className="font-medium mb-2">Schedule Data</h3>
          <Card className="h-32">
            <CardContent className="p-0 h-full">
              <div
                onClick={() => scheduleFileRef.current?.click()}
                className={`
                  h-full p-6 border-2 border-dashed rounded-lg cursor-pointer
                  transition-colors duration-200 flex flex-col items-center justify-center gap-2
                  ${scheduleFile ? 'border-success bg-success/5' : 'border-border hover:border-primary hover:bg-primary/5'}
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <input
                  ref={scheduleFileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleScheduleFileChange}
                  disabled={isLoading}
                  className="hidden"
                />
                
                {scheduleFile ? (
                  <>
                    <CheckCircle className="h-6 w-6 text-success" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-success">{scheduleFile.file.name}</p>
                      <p className="text-xs text-muted-foreground">Ready to process</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setScheduleFile(null);
                        if (scheduleFileRef.current) scheduleFileRef.current.value = '';
                      }}
                      className="mt-1"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-sm font-medium">Upload schedule file</p>
                      <p className="text-xs text-muted-foreground">Excel file with month grid schedule</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Backend Required Notice */}
      <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="p-1 bg-destructive/10 rounded">
            <AlertCircle className="h-4 w-4 text-destructive" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-destructive">Backend Server Required for Real Processing</p>
            <p className="text-muted-foreground mt-1">
              To process your actual files and get accurate attendance data, start the Python backend:
            </p>
            <code className="block mt-2 p-2 bg-muted rounded text-xs font-mono">
              cd backend && uvicorn app:app --reload --port 8000
            </code>
            <p className="text-muted-foreground mt-2">
              Without the backend, uploading files will only show demo data for UI testing.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Processing files...</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
      )}

      <Button 
        onClick={handleSubmit}
        disabled={!punchFile || !scheduleFile || isLoading}
        className="w-full"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Process Attendance Files
          </>
        )}
      </Button>
    </div>
  );
};