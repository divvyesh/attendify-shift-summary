import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  FileText, 
  Brain, 
  Settings,
  CheckCircle,
  XCircle 
} from 'lucide-react';
import { MergedAttendanceData } from '@/lib/attendanceMerger';

interface DiagnosticPanelProps {
  result: MergedAttendanceData;
  onRunAIAnalysis: () => void;
  onTryAgain: () => void;
}

export const DiagnosticPanel = ({ 
  result, 
  onRunAIAnalysis, 
  onTryAgain 
}: DiagnosticPanelProps) => {
  if (result.records.length > 0) return null;

  // Parse the diagnostic information from warnings
  const headerWarning = result.warnings.find(w => w.includes('Headers found:'));
  const mappingWarning = result.warnings.find(w => w.includes('Mapped fields:'));
  const criticalFieldsWarning = result.warnings.find(w => w.includes('Critical fields missing:'));
  
  const headersFound = headerWarning 
    ? headerWarning.split('Headers found: ')[1] 
    : 'Unknown';
  
  const mappedFields = mappingWarning 
    ? mappingWarning.split('Mapped fields: ')[1].split(', ').filter(f => f && f !== 'None')
    : [];
  
  const missingCriticalFields = criticalFieldsWarning 
    ? criticalFieldsWarning.split('Critical fields missing: ')[1].split('.')[0].split(', ')
    : [];

  return (
    <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
          <AlertTriangle className="h-5 w-5" />
          Processing Diagnostic
          <Badge variant="outline" className="text-orange-600">
            0 records found
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">
                Unable to extract attendance records from your files.
              </p>
              <p className="text-sm text-muted-foreground">
                This usually happens when column headers don't match expected patterns or critical data is missing.
              </p>
            </div>
          </AlertDescription>
        </Alert>

        {/* File Summary */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Files Processed:</h4>
          <div className="text-sm space-y-1">
            {result.summary.filesProcessed.map((fileName, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>{fileName}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Headers Found */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Column Headers Detected:</h4>
          <div className="p-3 bg-muted rounded text-sm">
            <code>{headersFound}</code>
          </div>
        </div>

        {/* Field Mapping Status */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Field Mapping Status:</h4>
          <div className="grid gap-2">
            {/* Successfully Mapped */}
            {mappedFields.length > 0 && (
              <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 rounded">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Mapped: {mappedFields.join(', ')}</span>
              </div>
            )}
            
            {/* Missing Critical Fields */}
            {missingCriticalFields.length > 0 && (
              <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950 rounded">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm">Missing: {missingCriticalFields.join(', ')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Expected Fields Info */}
        <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded">
          <h5 className="font-medium text-sm text-blue-800 dark:text-blue-200 mb-2">
            Required Fields:
          </h5>
          <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <p><strong>employee_name</strong> or <strong>employee_id</strong>: Employee identifier</p>
            <p><strong>date</strong>: Work date or shift date</p>
            <p className="mt-2 text-blue-600 dark:text-blue-400">
              Optional: store, shift, scheduled_in/out, actual_in/out, status
            </p>
          </div>
        </div>

        {/* All Warnings */}
        {result.warnings.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Processing Warnings:</h4>
            <div className="space-y-1 text-sm">
              {result.warnings.map((warning, i) => (
                <div key={i} className="p-2 bg-yellow-50 dark:bg-yellow-950 rounded text-yellow-700 dark:text-yellow-300">
                  {warning}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 pt-4 border-t">
          <Button 
            onClick={onRunAIAnalysis}
            className="w-full"
            size="lg"
          >
            <Brain className="mr-2 h-4 w-4" />
            Run AI Analysis
          </Button>
          
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              onClick={onTryAgain}
              size="sm"
            >
              <Settings className="mr-2 h-3 w-3" />
              Try Different Files
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                console.log('Full diagnostic info:', result);
                alert('Check browser console for detailed diagnostic information');
              }}
            >
              View Debug Info
            </Button>
          </div>
        </div>

        {/* Help Text */}
        <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
          <p className="font-medium mb-1">💡 Tips for better results:</p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>Ensure your file has clear column headers</li>
            <li>Include employee names/IDs and dates</li>
            <li>Try the AI analysis for automatic column mapping</li>
            <li>Remove empty rows at the top of your spreadsheet</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};