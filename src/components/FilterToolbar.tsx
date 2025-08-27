import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Download, X } from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';
import { useAttendanceStore } from '@/store/attendanceStore';
import { Badge } from '@/components/ui/badge';

interface FilterToolbarProps {
  showExport?: boolean;
  onExport?: () => void;
}

export const FilterToolbar = ({ showExport = true, onExport }: FilterToolbarProps) => {
  const { filters, setFilters, getStores } = useAttendanceStore();
  const stores = getStores();

  const hasActiveFilters = filters.dateRange.from || filters.dateRange.to || 
    filters.store !== 'All stores' || filters.status !== 'All' || filters.search;

  const clearAllFilters = () => {
    setFilters({
      dateRange: { from: null, to: null },
      store: 'All stores',
      status: 'All',
      search: '',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <DateRangePicker />
          
          <Select value={filters.store} onValueChange={(value) => setFilters({ store: value })}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select store" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All stores">All stores</SelectItem>
              {stores.map((store) => (
                <SelectItem key={store} value={store}>
                  {store}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={filters.status} onValueChange={(value) => setFilters({ status: value })}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              <SelectItem value="Present">Present</SelectItem>
              <SelectItem value="Absent">Absent</SelectItem>
              <SelectItem value="Late">Late</SelectItem>
              <SelectItem value="Early-out">Early-out</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearAllFilters}>
              <X className="mr-2 h-3 w-3" />
              Clear Filters
            </Button>
          )}
          
          {showExport && onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="mr-2 h-3 w-3" />
              Export CSV
            </Button>
          )}
        </div>
      </div>
      
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.dateRange.from && (
            <Badge variant="secondary">
              Date: {filters.dateRange.from.toLocaleDateString()} 
              {filters.dateRange.to && ` - ${filters.dateRange.to.toLocaleDateString()}`}
            </Badge>
          )}
          {filters.store !== 'All stores' && (
            <Badge variant="secondary">Store: {filters.store}</Badge>
          )}
          {filters.status !== 'All' && (
            <Badge variant="secondary">Status: {filters.status}</Badge>
          )}
          {filters.search && (
            <Badge variant="secondary">Search: "{filters.search}"</Badge>
          )}
        </div>
      )}
    </div>
  );
};