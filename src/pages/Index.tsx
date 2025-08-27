import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUploader } from '@/components/FileUploader';
import { SampleDataToggle } from '@/components/SampleDataToggle';
import { Upload, BarChart3, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { records, clearData } = useAttendanceStore();
  const [isLoading, setIsLoading] = useState(false);

  // Redirect to team dashboard if data exists
  useEffect(() => {
    if (records.length > 0) {
      navigate('/team');
    }
  }, [records.length, navigate]);

  const handleDataProcessed = (data: any) => {
    toast({
      title: "Files processed successfully!",
      description: "Redirecting to team dashboard...",
    });
    // Navigation will happen via useEffect when records update
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <BarChart3 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Attendance Summariser</h1>
              <p className="text-lg text-muted-foreground mt-2">
                Upload Excel/CSV timesheets and see team-level metrics per budtender
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* File Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload New Files
                </CardTitle>
                <CardDescription>
                  Upload Excel (.xlsx) or CSV files with attendance data to analyze your team's performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Expected format:</strong> employee_name, employee_id, store, date, shift, scheduled_in, scheduled_out, actual_in, actual_out, status
                  </AlertDescription>
                </Alert>
                <FileUploader 
                  onDataProcessed={handleDataProcessed}
                  isLoading={isLoading}
                  setIsLoading={setIsLoading}
                />
              </CardContent>
            </Card>

            {/* Sample Data */}
            <SampleDataToggle />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
