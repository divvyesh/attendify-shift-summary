import { useState, useMemo } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Download, 
  Filter, 
  Search, 
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Timer
} from 'lucide-react';
import { format } from 'date-fns';

interface DayRecord {
  date: string;
  shift_type: string;
  sched_start_dt: string;
  sched_end_dt: string;
  actual_in: string | null;
  actual_out: string | null;
  actual_out1: string | null;
  actual_in2: string | null;
  sched_minutes: number;
  worked_minutes: number;
  worked_minutes_clipped: number;
  attendance_fraction: number;
  present: boolean;
  tardy: boolean;
  early_dismissal: boolean;
}

interface DayTableProps {
  dayRecords: DayRecord[];
  employeeName: string;
}

type FilterType = 'all' | 'present' | 'absent' | 'tardy' | 'early';

export const DayTable = ({ dayRecords, employeeName }: DayTableProps) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRecords = useMemo(() => {
    let filtered = dayRecords;

    // Apply filter
    switch (filter) {
      case 'present':
        filtered = filtered.filter(record => record.present);
        break;
      case 'absent':
        filtered = filtered.filter(record => !record.present);
        break;
      case 'tardy':
        filtered = filtered.filter(record => record.tardy);
        break;
      case 'early':
        filtered = filtered.filter(record => record.early_dismissal);
        break;
    }

    // Apply search
    if (searchTerm) {
      filtered = filtered.filter(record =>
        record.date.includes(searchTerm) ||
        record.shift_type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [dayRecords, filter, searchTerm]);

  const formatDateTime = (dateTimeStr: string | null) => {
    if (!dateTimeStr) return '-';
    try {
      return format(new Date(dateTimeStr), 'h:mm a');
    } catch {
      return dateTimeStr;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const handleDownload = () => {
    // This would trigger the CSV download from the backend
    // Implementation would depend on how job IDs are managed
    console.log('Download CSV functionality to be implemented');
  };

  const getStatusBadge = (record: DayRecord) => {
    if (!record.present) {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Absent</Badge>;
    }
    
    const badges = [];
    
    if (record.tardy) {
      badges.push(<Badge key="tardy" variant="secondary" className="text-warning"><Timer className="w-3 h-3 mr-1" />Tardy</Badge>);
    }
    
    if (record.early_dismissal) {
      badges.push(<Badge key="early" variant="secondary" className="text-destructive"><AlertTriangle className="w-3 h-3 mr-1" />Early</Badge>);
    }
    
    if (badges.length === 0) {
      badges.push(<Badge key="present" variant="default"><CheckCircle2 className="w-3 h-3 mr-1" />Present</Badge>);
    }
    
    return <div className="flex gap-1">{badges}</div>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Day-Level Attendance Records
          </CardTitle>
          <Button onClick={handleDownload} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filter} onValueChange={(value: FilterType) => setFilter(value)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Records</SelectItem>
                <SelectItem value="present">Present Only</SelectItem>
                <SelectItem value="absent">Absent Only</SelectItem>
                <SelectItem value="tardy">Tardy Only</SelectItem>
                <SelectItem value="early">Early Dismissal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by date or shift..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Actual In</TableHead>
                <TableHead>Actual Out</TableHead>
                <TableHead>Hours Worked</TableHead>
                <TableHead>Attendance %</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No records match the current filter
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {formatDate(record.date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{record.shift_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>
                        {formatDateTime(record.sched_start_dt)} - {formatDateTime(record.sched_end_dt)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(record.sched_minutes / 60).toFixed(1)}h
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatDateTime(record.actual_in)}
                    </TableCell>
                    <TableCell>
                      {formatDateTime(record.actual_out)}
                    </TableCell>
                    <TableCell>
                      <div>
                        {(record.worked_minutes_clipped / 60).toFixed(1)}h
                      </div>
                      {record.worked_minutes !== record.worked_minutes_clipped && (
                        <div className="text-xs text-muted-foreground">
                          ({(record.worked_minutes / 60).toFixed(1)}h actual)
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className={`font-medium ${
                        record.attendance_fraction >= 0.95 ? 'text-success' :
                        record.attendance_fraction >= 0.85 ? 'text-warning' :
                        'text-destructive'
                      }`}>
                        {(record.attendance_fraction * 100).toFixed(1)}%
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(record)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {filteredRecords.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredRecords.length} of {dayRecords.length} records
          </div>
        )}
      </CardContent>
    </Card>
  );
};