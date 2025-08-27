import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Brain, 
  CheckCircle, 
  AlertTriangle, 
  Lightbulb, 
  ArrowRight,
  Loader2,
  RefreshCw 
} from 'lucide-react';
import { AIAnalysis, ColumnMapping } from '@/lib/fileAnalyzer';

interface AIAnalysisPanelProps {
  fileName: string;
  aiAnalysis?: AIAnalysis;
  isLoading: boolean;
  onRunAIAnalysis: () => Promise<void>;
  onApproveMapping: (mappings: ColumnMapping[]) => void;
  onRejectAnalysis: () => void;
}

const STANDARD_FIELDS = [
  'employee_name',
  'employee_id', 
  'store',
  'date',
  'shift',
  'scheduled_in',
  'scheduled_out',
  'actual_in',
  'actual_out',
  'status',
  'hours_worked',
  'attendance_pct'
];

export const AIAnalysisPanel = ({ 
  fileName, 
  aiAnalysis, 
  isLoading, 
  onRunAIAnalysis, 
  onApproveMapping,
  onRejectAnalysis 
}: AIAnalysisPanelProps) => {
  const [editedMappings, setEditedMappings] = useState<ColumnMapping[]>(aiAnalysis?.columnMappings || []);

  const handleMappingChange = (index: number, newSuggestion: string) => {
    const updated = [...editedMappings];
    updated[index] = {
      ...updated[index],
      suggested: newSuggestion,
      confidence: newSuggestion === aiAnalysis?.columnMappings[index]?.suggested ? 
        aiAnalysis.columnMappings[index].confidence : 75
    };
    setEditedMappings(updated);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (confidence >= 70) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'schedule': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'punches': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'combined': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (!aiAnalysis && !isLoading) {
    return (
      <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-orange-800 dark:text-orange-200">
            <Brain className="h-4 w-4" />
            AI Analysis Recommended
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-orange-700 dark:text-orange-300 mb-4">
            This file has low confidence or ambiguous structure. AI analysis can help identify the correct column mappings.
          </p>
          <Button onClick={onRunAIAnalysis} size="sm" className="w-full">
            <Brain className="mr-2 h-4 w-4" />
            Run AI Analysis
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-primary">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <div>
              <p className="font-medium">AI is analyzing {fileName}...</p>
              <p className="text-sm text-muted-foreground">This may take a few moments</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!aiAnalysis) return null;

  return (
    <Card className="border-primary">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          AI Analysis Results
          <Badge className={getTypeColor(aiAnalysis.fileType)}>
            {aiAnalysis.fileType}
          </Badge>
          <Badge className={getConfidenceColor(aiAnalysis.confidence)}>
            {aiAnalysis.confidence}% confident
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Reasoning */}
        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
          <h4 className="font-medium mb-2 text-blue-800 dark:text-blue-200">Analysis Reasoning</h4>
          <p className="text-sm text-blue-700 dark:text-blue-300">{aiAnalysis.reasoning}</p>
        </div>

        {/* Column Mappings */}
        {editedMappings.length > 0 && (
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Column Mappings
            </h4>
            <div className="grid gap-3">
              {editedMappings.map((mapping, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{mapping.original}</p>
                  </div>
                  
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  
                  <div className="flex-1">
                    <Select 
                      value={mapping.suggested}
                      onValueChange={(value) => handleMappingChange(index, value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Skip this column</SelectItem>
                        {STANDARD_FIELDS.map(field => (
                          <SelectItem key={field} value={field}>
                            {field}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Badge className={getConfidenceColor(mapping.confidence)} variant="outline">
                    {mapping.confidence}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {aiAnalysis.warnings.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                {aiAnalysis.warnings.map((warning, i) => (
                  <p key={i} className="text-sm">{warning}</p>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Suggestions */}
        {aiAnalysis.suggestions.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg">
            <h4 className="font-medium mb-2 text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              AI Suggestions
            </h4>
            <div className="space-y-1">
              {aiAnalysis.suggestions.map((suggestion, i) => (
                <p key={i} className="text-sm text-amber-700 dark:text-amber-300">{suggestion}</p>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button 
            onClick={() => onApproveMapping(editedMappings)}
            className="flex-1"
            disabled={editedMappings.length === 0}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Apply Mappings
          </Button>
          
          <Button variant="outline" onClick={onRejectAnalysis}>
            Use Original Analysis
          </Button>
          
          <Button variant="outline" size="icon" onClick={onRunAIAnalysis} title="Re-analyze">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};