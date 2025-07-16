import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
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

  const onPunchDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setPunchFile({ file: acceptedFiles[0], status: 'ready' });
      setError(null);
    }
  }, []);

  const onScheduleDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setScheduleFile({ file: acceptedFiles[0], status: 'ready' });
      setError(null);
    }
  }, []);

  const punchDropzone = useDropzone({
    onDrop: onPunchDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1,
    disabled: isLoading
  });

  const scheduleDropzone = useDropzone({
    onDrop: onScheduleDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1,
    disabled: isLoading
  });

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

      const response = await fetch('http://localhost:8000/attendance/compute', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to process files');
      }

      const data = await response.json();
      onDataProcessed(data);
      
      toast({
        title: "Files processed successfully!",
        description: `Analysis complete for ${data.employee_name || 'employee'}`,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
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

  const FileDropzone = ({ 
    dropzone, 
    file, 
    title, 
    description 
  }: { 
    dropzone: any; 
    file: UploadedFile | null; 
    title: string; 
    description: string; 
  }) => (
    <Card className="h-32">
      <CardContent className="p-0 h-full">
        <div
          {...dropzone.getRootProps()}
          className={`
            h-full p-6 border-2 border-dashed rounded-lg cursor-pointer
            transition-colors duration-200 flex flex-col items-center justify-center gap-2
            ${dropzone.isDragActive ? 'border-primary bg-primary/5' : 'border-border'}
            ${file ? 'border-success bg-success/5' : ''}
            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5'}
          `}
        >
          <input {...dropzone.getInputProps()} />
          
          {file ? (
            <>
              <CheckCircle className="h-6 w-6 text-success" />
              <div className="text-center">
                <p className="text-sm font-medium text-success">{file.file.name}</p>
                <p className="text-xs text-muted-foreground">Ready to process</p>
              </div>
            </>
          ) : dropzone.isDragActive ? (
            <>
              <Upload className="h-6 w-6 text-primary" />
              <p className="text-sm text-primary">Drop file here</p>
            </>
          ) : (
            <>
              <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="font-medium mb-2">Punch Clock Data</h3>
          <FileDropzone
            dropzone={punchDropzone}
            file={punchFile}
            title="Upload punch clock file"
            description="Excel file with Daily Hours Reports"
          />
        </div>
        
        <div>
          <h3 className="font-medium mb-2">Schedule Data</h3>
          <FileDropzone
            dropzone={scheduleDropzone}
            file={scheduleFile}
            title="Upload schedule file"
            description="Excel file with month grid schedule"
          />
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