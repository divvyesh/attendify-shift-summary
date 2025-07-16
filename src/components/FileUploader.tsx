import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { processAttendanceFiles } from '@/lib/attendanceProcessor';

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
      // Simulate progress for UI feedback
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 15, 90));
      }, 300);

      try {
        // Process files directly in the browser
        const result = await processAttendanceFiles(punchFile.file, scheduleFile.file);
        
        clearInterval(progressInterval);
        setProgress(100);
        
        // Convert to expected format
        const processedData = {
          employee_name: result.employee_name,
          summary: result.summary,
          day_level: result.day_level,
          config_used: {
            am: { start: "09:45", end: "16:30", cross_midnight: false },
            pm: { start: "16:00", end: "00:15", cross_midnight: true },
            tardy_minutes: 5,
            early_minutes: 15,
            timezone: "America/New_York"
          }
        };
        
        onDataProcessed(processedData);
        
        toast({
          title: "Files processed successfully!",
          description: `Analysis complete for ${result.employee_name}${result.warnings.length > 0 ? ` (${result.warnings.length} warnings)` : ''}`,
        });
        
        if (result.warnings.length > 0) {
          console.warn('Processing warnings:', result.warnings);
        }
        
      } catch (processingError) {
        clearInterval(progressInterval);
        const errorMessage = processingError instanceof Error ? processingError.message : 'Failed to process files';
        throw new Error(errorMessage);
      }

    } catch (err) {
      console.error('Processing error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during file processing';
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

      {/* Client-Side Processing Notice */}
      <div className="bg-success/10 border border-success/20 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="p-1 bg-success/10 rounded">
            <CheckCircle className="h-4 w-4 text-success" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-success">Ready to Process Your Real Files</p>
            <p className="text-muted-foreground mt-1">
              This app processes your Excel files directly in the browser - no server needed! 
              Upload your punch clock and schedule files to get accurate attendance analysis:
            </p>
            <ul className="mt-2 text-xs text-muted-foreground space-y-1">
              <li>• Morning shift: 9:45a - 4:30p</li>
              <li>• Evening shift: 4:00p - 12:15a (cross-midnight)</li>
              <li>• Tardy: {'>'}5min late | Early dismissal: {'>'}15min early</li>
            </ul>
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
            <span className="text-sm">Processing your files...</span>
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
            Processing Your Files...
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