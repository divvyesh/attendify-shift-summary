import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { processCSVFile } from '@/lib/csvProcessor';
import { useAttendanceStore } from '@/store/attendanceStore';

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
  const [attendanceFile, setAttendanceFile] = useState<UploadedFile | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { setRecords } = useAttendanceStore();
  
  const fileRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      setError(`Invalid file type. Please upload .xlsx, .xls, or .csv files only.`);
      return false;
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      setError('File size too large. Maximum size is 50MB.');
      return false;
    }
    
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      setAttendanceFile({ file, status: 'ready' });
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!attendanceFile) {
      setError('Please upload an attendance file');
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setError(null);

    try {
      setProgress(30);
      
      const result = await processCSVFile(attendanceFile.file);
      
      setProgress(70);
      
      if (result.records.length === 0) {
        throw new Error('No valid attendance records found in file');
      }
      
      setRecords(result.records);
      setProgress(100);
      
      toast({
        title: "File processed successfully!",
        description: `${result.records.length} attendance records processed${result.warnings.length > 0 ? ` (${result.warnings.length} warnings)` : ''}`,
      });
      
      if (result.warnings.length > 0) {
        console.warn('Processing warnings:', result.warnings);
      }
      
      onDataProcessed(result);

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
      {/* Single File Upload */}
      <div>
        <h3 className="font-medium mb-2">Attendance Data File</h3>
        <Card className="h-40">
          <CardContent className="p-0 h-full">
            <div
              onClick={() => fileRef.current?.click()}
              className={`
                h-full p-6 border-2 border-dashed rounded-lg cursor-pointer
                transition-colors duration-200 flex flex-col items-center justify-center gap-2
                ${attendanceFile ? 'border-success bg-success/5' : 'border-border hover:border-primary hover:bg-primary/5'}
                ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                disabled={isLoading}
                className="hidden"
              />
              
              {attendanceFile ? (
                <>
                  <CheckCircle className="h-8 w-8 text-success" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-success">{attendanceFile.file.name}</p>
                    <p className="text-xs text-muted-foreground">Ready to process</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(attendanceFile.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAttendanceFile(null);
                      if (fileRef.current) fileRef.current.value = '';
                    }}
                    className="mt-1"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Upload Attendance File</p>
                    <p className="text-xs text-muted-foreground">Excel (.xlsx, .xls) or CSV file</p>
                    <p className="text-xs text-muted-foreground mt-1">Max 50MB</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Processing Notice */}
      <div className="bg-success/10 border border-success/20 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="p-1 bg-success/10 rounded">
            <CheckCircle className="h-4 w-4 text-success" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-success">Client-Side Processing</p>
            <p className="text-muted-foreground mt-1">
              Your file is processed securely in your browser - no data is sent to external servers.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Expected columns: employee_name, employee_id, store, date, shift, scheduled_in, scheduled_out, actual_in, actual_out, status
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
            <span className="text-sm">Processing your file...</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
      )}

      <Button 
        onClick={handleSubmit}
        disabled={!attendanceFile || isLoading}
        className="w-full"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing File...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Process Attendance File
          </>
        )}
      </Button>
    </div>
  );
};