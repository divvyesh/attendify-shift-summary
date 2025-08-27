import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, Users, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAttendanceStore } from '@/store/attendanceStore';
import { sampleAttendanceData } from '@/data/sampleData';
import { useToast } from '@/hooks/use-toast';

export const SampleDataToggle = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setRecords } = useAttendanceStore();

  const handleLoadSampleData = () => {
    setRecords(sampleAttendanceData);
    
    toast({
      title: "Sample data loaded!",
      description: "4 employees with 17 attendance records loaded for demo purposes.",
    });
    
    navigate('/team');
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 p-2 bg-primary/10 rounded-full w-fit">
          <Database className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-primary">Try Sample Data</CardTitle>
        <CardDescription>
          Explore the app with pre-loaded sample data from a dispensary team
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <Users className="h-4 w-4 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">4 Employees</p>
            <p className="text-xs text-muted-foreground">Multi-store team</p>
          </div>
          <div className="space-y-1">
            <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">17 Records</p>
            <p className="text-xs text-muted-foreground">May 1-4, 2025</p>
          </div>
          <div className="space-y-1">
            <Database className="h-4 w-4 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">3 Stores</p>
            <p className="text-xs text-muted-foreground">Boston area</p>
          </div>
        </div>
        
        <Button 
          onClick={handleLoadSampleData}
          className="w-full"
          size="lg"
        >
          <Database className="mr-2 h-4 w-4" />
          Load Sample Data
        </Button>
        
        <p className="text-xs text-center text-muted-foreground">
          Includes realistic attendance patterns: tardiness, early dismissals, and absences
        </p>
      </CardContent>
    </Card>
  );
};