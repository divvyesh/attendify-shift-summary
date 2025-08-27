import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, X, Info, Users, Calendar, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAttendanceStore } from '@/store/attendanceStore';
import { analyzeFile, FileInsights } from '@/lib/fileAnalyzer';
import { processExcelFile, processCSVFile, ProcessedData } from '@/lib/excelProcessor';
import { mergeAttendanceFiles } from '@/lib/attendanceMerger';

interface FileUploaderProps {
  onDataProcessed: (data: any) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

interface UploadedFile {
  file: File;
  status: 'ready' | 'analyzing' | 'analyzed' | 'error';
  insights?: FileInsights;
  processedData?: ProcessedData;
}

export const FileUploader = ({ onDataProcessed, isLoading, setIsLoading }: FileUploaderProps) => {
  const [file1, setFile1] = useState<UploadedFile | null>(null);
  const [file2, setFile2] = useState<UploadedFile | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { setRecords } = useAttendanceStore();
  
  const file1Ref = useRef<HTMLInputElement>(null);
  const file2Ref = useRef<HTMLInputElement>(null);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, fileNumber: 1 | 2) => {
    const file = e.target.files?.[0];
    if (!file || !validateFile(file)) return;

    const uploadedFile: UploadedFile = { file, status: 'analyzing' };
    
    if (fileNumber === 1) {
      setFile1(uploadedFile);
    } else {
      setFile2(uploadedFile);
    }
    
    setError(null);

    try {
      // Analyze the file
      const insights = await analyzeFile(file);
      
      // Process the file data
      const processedData = file.name.toLowerCase().endsWith('.csv') 
        ? await processCSVFile(file)
        : await processExcelFile(file);

      const analyzedFile: UploadedFile = {
        file,
        status: 'analyzed',
        insights,
        processedData
      };

      if (fileNumber === 1) {
        setFile1(analyzedFile);
      } else {
        setFile2(analyzedFile);
      }

    } catch (error) {
      const errorFile: UploadedFile = { file, status: 'error' };
      if (fileNumber === 1) {
        setFile1(errorFile);
      } else {
        setFile2(errorFile);
      }
      setError(`Failed to analyze ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSubmit = async () => {
    if (!file1?.insights || !file1?.processedData) {
      setError('Please upload at least one valid file');
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setError(null);

    try {
      setProgress(30);
      
      const file1Data = { insights: file1.insights, processedData: file1.processedData };
      const file2Data = file2?.insights && file2?.processedData 
        ? { insights: file2.insights, processedData: file2.processedData }
        : undefined;

      const result = mergeAttendanceFiles(file1Data, file2Data);
      
      setProgress(70);
      
      if (result.records.length === 0) {
        throw new Error('No valid attendance records found in files');
      }
      
      setRecords(result.records);
      setProgress(100);
      
      toast({
        title: "Files processed successfully!",
        description: `${result.records.length} attendance records from ${result.summary.filesProcessed.length} file(s)${result.warnings.length > 0 ? ` (${result.warnings.length} warnings)` : ''}`,
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

  const removeFile = (fileNumber: 1 | 2) => {
    if (fileNumber === 1) {
      setFile1(null);
      if (file1Ref.current) file1Ref.current.value = '';
    } else {
      setFile2(null);
      if (file2Ref.current) file2Ref.current.value = '';
    }
  };

  const renderFileUpload = (fileNumber: 1 | 2, uploadedFile: UploadedFile | null, fileRef: React.RefObject<HTMLInputElement>) => (
    <Card className="h-40">
      <CardContent className="p-0 h-full">
        <div
          onClick={() => fileRef.current?.click()}
          className={`
            h-full p-6 border-2 border-dashed rounded-lg cursor-pointer
            transition-colors duration-200 flex flex-col items-center justify-center gap-2
            ${uploadedFile?.status === 'analyzed' ? 'border-success bg-success/5' : 
              uploadedFile?.status === 'analyzing' ? 'border-primary bg-primary/5' :
              uploadedFile?.status === 'error' ? 'border-destructive bg-destructive/5' :
              'border-border hover:border-primary hover:bg-primary/5'}
            ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => handleFileChange(e, fileNumber)}
            disabled={isLoading}
            className="hidden"
          />
          
          {uploadedFile ? (
            <>
              {uploadedFile.status === 'analyzing' && <Loader2 className="h-8 w-8 text-primary animate-spin" />}
              {uploadedFile.status === 'analyzed' && <CheckCircle className="h-8 w-8 text-success" />}
              {uploadedFile.status === 'error' && <AlertCircle className="h-8 w-8 text-destructive" />}
              
              <div className="text-center">
                <p className="text-sm font-medium">{uploadedFile.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {uploadedFile.status === 'analyzing' && 'Analyzing...'}
                  {uploadedFile.status === 'analyzed' && `${uploadedFile.insights?.fileType} file (${uploadedFile.insights?.confidence.toFixed(0)}% confidence)`}
                  {uploadedFile.status === 'error' && 'Analysis failed'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              
              {uploadedFile.status !== 'analyzing' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(fileNumber);
                  }}
                  className="mt-1"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Upload File {fileNumber}</p>
                <p className="text-xs text-muted-foreground">Excel (.xlsx, .xls) or CSV file</p>
                <p className="text-xs text-muted-foreground mt-1">Max 50MB</p>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderInsights = (file: UploadedFile) => {
    if (!file.insights || file.status !== 'analyzed') return null;

    const { insights } = file;
    const getTypeColor = (type: string) => {
      switch (type) {
        case 'schedule': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
        case 'punches': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        case 'combined': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
        default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      }
    };

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" />
            File Analysis
            <Badge className={getTypeColor(insights.fileType)}>
              {insights.fileType}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="grid grid-cols-3 gap-4 text-sm">
            {insights.employeeCount !== undefined && (
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Employees:</span>
                <span className="font-medium">{insights.employeeCount}</span>
              </div>
            )}
            
            {insights.recordCount !== undefined && (
              <div className="flex items-center gap-2">
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Records:</span>
                <span className="font-medium">{insights.recordCount}</span>
              </div>
            )}
            
            {insights.dateRange && (
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Range:</span>
                <span className="font-medium text-xs">{insights.dateRange.start} to {insights.dateRange.end}</span>
              </div>
            )}
          </div>
          
          {insights.keyColumns.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Key columns detected:</p>
              <div className="flex flex-wrap gap-1">
                {insights.keyColumns.slice(0, 6).map((col, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {col}
                  </Badge>
                ))}
                {insights.keyColumns.length > 6 && (
                  <Badge variant="outline" className="text-xs">
                    +{insights.keyColumns.length - 6} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Multi-File Upload */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h3 className="font-medium mb-2">Primary File</h3>
          {renderFileUpload(1, file1, file1Ref)}
        </div>
        <div>
          <h3 className="font-medium mb-2">Secondary File (Optional)</h3>
          {renderFileUpload(2, file2, file2Ref)}
        </div>
      </div>

      {/* File Insights */}
      {(file1?.insights || file2?.insights) && (
        <div className="space-y-4">
          <h3 className="font-medium">File Analysis</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {file1 && renderInsights(file1)}
            {file2 && renderInsights(file2)}
          </div>
        </div>
      )}

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
        disabled={!file1?.insights || isLoading}
        className="w-full"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing Files...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Process {file2?.insights ? 'Files' : 'File'}
          </>
        )}
      </Button>
    </div>
  );
};