import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, X, Info, Users, Calendar, FileText, Brain } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAttendanceStore } from '@/store/attendanceStore';
import { analyzeFile, FileInsights, getAIAnalysis, AIAnalysis, ColumnMapping } from '@/lib/fileAnalyzer';
import { processExcelFile, processCSVFile, ProcessedData } from '@/lib/excelProcessor';
import { mergeAttendanceFiles } from '@/lib/attendanceMerger';
import { normalizeData, NormalizedData } from '@/lib/dataNormalizer';
import { AIAnalysisPanel } from './AIAnalysisPanel';

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
  aiAnalysis?: AIAnalysis;
  isLoadingAI?: boolean;
  normalizedData?: NormalizedData;
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
      
      // Use normalized data if available, otherwise use processed data
      const file1ProcessedData = file1.normalizedData ? {
        headers: file1.normalizedData.headers,
        rows: file1.normalizedData.rows,
        metadata: {
          ...file1.processedData.metadata,
          ...file1.normalizedData.metadata
        }
      } : file1.processedData;

      const file2ProcessedData = file2?.normalizedData ? {
        headers: file2.normalizedData.headers,
        rows: file2.normalizedData.rows,
        metadata: {
          ...file2.processedData!.metadata,
          ...file2.normalizedData.metadata
        }
      } : file2?.processedData;
      
      const file1Data = { insights: file1.insights, processedData: file1ProcessedData };
      const file2Data = file2?.insights && file2ProcessedData 
        ? { insights: file2.insights, processedData: file2ProcessedData }
        : undefined;

      const result = mergeAttendanceFiles(file1Data, file2Data);
      
      setProgress(70);
      
      if (result.records.length === 0) {
        throw new Error('No valid attendance records found in files');
      }
      
      setRecords(result.records);
      setProgress(100);
      
      // Enhanced success message with normalization info
      const normalizationInfo = [];
      if (file1.normalizedData) {
        normalizationInfo.push(`File 1: ${file1.normalizedData.metadata.mappingsApplied.length} column mappings applied`);
      }
      if (file2?.normalizedData) {
        normalizationInfo.push(`File 2: ${file2.normalizedData.metadata.mappingsApplied.length} column mappings applied`);
      }
      
      toast({
        title: "Files processed successfully!",
        description: `${result.records.length} attendance records from ${result.summary.filesProcessed.length} file(s)${result.warnings.length > 0 ? ` (${result.warnings.length} warnings)` : ''}${normalizationInfo.length > 0 ? `. ${normalizationInfo.join(', ')}` : ''}`,
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

  // AI Analysis Handlers
  const handleRunAIAnalysis = async (fileNumber: 1 | 2) => {
    const targetFile = fileNumber === 1 ? file1 : file2;
    if (!targetFile?.insights || !targetFile?.processedData) return;

    // Set loading state
    const updatedFile = { 
      ...targetFile, 
      isLoadingAI: true 
    };
    
    if (fileNumber === 1) {
      setFile1(updatedFile);
    } else {
      setFile2(updatedFile);
    }

    try {
      const sampleRows = targetFile.processedData.rows.slice(0, 5);
      const aiAnalysis = await getAIAnalysis(
        targetFile.insights.fileName,
        targetFile.insights.keyColumns,
        sampleRows,
        {
          type: targetFile.insights.fileType,
          confidence: targetFile.insights.confidence
        }
      );

      const analyzedFile = {
        ...targetFile,
        aiAnalysis,
        isLoadingAI: false
      };

      if (fileNumber === 1) {
        setFile1(analyzedFile);
      } else {
        setFile2(analyzedFile);
      }

      toast({
        title: "AI analysis complete",
        description: `Found ${aiAnalysis.columnMappings.length} column mappings with ${aiAnalysis.confidence}% confidence`,
      });

    } catch (error) {
      console.error('AI Analysis Error:', error);
      
      const errorFile = {
        ...targetFile,
        isLoadingAI: false
      };

      if (fileNumber === 1) {
        setFile1(errorFile);
      } else {
        setFile2(errorFile);
      }

      toast({
        title: "AI analysis failed",
        description: error instanceof Error ? error.message : 'Unable to analyze file with AI',
        variant: "destructive",
      });
    }
  };

  const handleApproveMapping = (fileNumber: 1 | 2, mappings: ColumnMapping[]) => {
    const targetFile = fileNumber === 1 ? file1 : file2;
    if (!targetFile?.processedData) return;

    try {
      const normalizedData = normalizeData(targetFile.processedData, mappings);
      
      const updatedFile = {
        ...targetFile,
        normalizedData
      };

      if (fileNumber === 1) {
        setFile1(updatedFile);
      } else {
        setFile2(updatedFile);
      }

      toast({
        title: "Column mappings applied",
        description: `Normalized ${normalizedData.metadata.rowsProcessed} rows with ${mappings.length} mappings`,
      });

    } catch (error) {
      console.error('Normalization Error:', error);
      toast({
        title: "Normalization failed",
        description: error instanceof Error ? error.message : 'Failed to apply column mappings',
        variant: "destructive",
      });
    }
  };

  const handleRejectAnalysis = (fileNumber: 1 | 2) => {
    const targetFile = fileNumber === 1 ? file1 : file2;
    if (!targetFile) return;

    const updatedFile = {
      ...targetFile,
      aiAnalysis: undefined
    };

    if (fileNumber === 1) {
      setFile1(updatedFile);
    } else {
      setFile2(updatedFile);
    }

    toast({
      title: "AI analysis dismissed",
      description: "Using original file analysis",
    });
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

      {/* AI Analysis Panels */}
      {((file1?.insights?.needsAIReview || file1?.aiAnalysis || file1?.isLoadingAI) || 
        (file2?.insights?.needsAIReview || file2?.aiAnalysis || file2?.isLoadingAI)) && (
        <div className="space-y-4">
          <h3 className="font-medium flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Analysis
          </h3>
          <div className="grid gap-4">
            {file1 && (file1.insights?.needsAIReview || file1.aiAnalysis || file1.isLoadingAI) && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                  File 1: {file1.insights?.fileName}
                </h4>
                <AIAnalysisPanel
                  fileName={file1.insights?.fileName || file1.file.name}
                  aiAnalysis={file1.aiAnalysis}
                  isLoading={file1.isLoadingAI || false}
                  onRunAIAnalysis={() => handleRunAIAnalysis(1)}
                  onApproveMapping={(mappings) => handleApproveMapping(1, mappings)}
                  onRejectAnalysis={() => handleRejectAnalysis(1)}
                />
              </div>
            )}
            
            {file2 && (file2.insights?.needsAIReview || file2.aiAnalysis || file2.isLoadingAI) && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-muted-foreground">
                  File 2: {file2.insights?.fileName}
                </h4>
                <AIAnalysisPanel
                  fileName={file2.insights?.fileName || file2.file.name}
                  aiAnalysis={file2.aiAnalysis}
                  isLoading={file2.isLoadingAI || false}
                  onRunAIAnalysis={() => handleRunAIAnalysis(2)}
                  onApproveMapping={(mappings) => handleApproveMapping(2, mappings)}
                  onRejectAnalysis={() => handleRejectAnalysis(2)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Processing Notice */}
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="p-1 bg-blue-100 dark:bg-blue-900 rounded">
            <Brain className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-blue-800 dark:text-blue-200">Smart File Processing</p>
            <p className="text-blue-700 dark:text-blue-300 mt-1">
              Files are processed locally in your browser. AI analysis is available for ambiguous files to improve column mapping accuracy.
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              Standard fields: employee_name, employee_id, store, date, shift, scheduled_in, scheduled_out, actual_in, actual_out, status
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