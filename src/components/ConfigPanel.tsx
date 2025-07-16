import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Settings, Clock, AlertTriangle, Globe } from 'lucide-react';

interface ShiftConfig {
  start: string;
  end: string;
  cross_midnight: boolean;
}

interface PolicyConfig {
  am: ShiftConfig;
  pm: ShiftConfig;
  tardy_minutes: number;
  early_minutes: number;
  timezone: string;
}

export const ConfigPanel = () => {
  const [config, setConfig] = useState<PolicyConfig>({
    am: {
      start: '09:45',
      end: '16:30',
      cross_midnight: false
    },
    pm: {
      start: '16:00',
      end: '00:15',
      cross_midnight: true
    },
    tardy_minutes: 5,
    early_minutes: 15,
    timezone: 'America/New_York'
  });

  const updateAmShift = (field: keyof ShiftConfig, value: string | boolean) => {
    setConfig(prev => ({
      ...prev,
      am: { ...prev.am, [field]: value }
    }));
  };

  const updatePmShift = (field: keyof ShiftConfig, value: string | boolean) => {
    setConfig(prev => ({
      ...prev,
      pm: { ...prev.pm, [field]: value }
    }));
  };

  const updatePolicy = (field: keyof PolicyConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const timezones = [
    'America/New_York',
    'America/Chicago', 
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo'
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Shift Configurations
          </CardTitle>
          <CardDescription>
            Configure default start and end times for AM and PM shifts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* AM Shift */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">AM Shift</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="am-start">Start Time</Label>
                <Input
                  id="am-start"
                  type="time"
                  value={config.am.start}
                  onChange={(e) => updateAmShift('start', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="am-end">End Time</Label>
                <Input
                  id="am-end"
                  type="time"
                  value={config.am.end}
                  onChange={(e) => updateAmShift('end', e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="am-midnight"
                  checked={config.am.cross_midnight}
                  onCheckedChange={(checked) => updateAmShift('cross_midnight', checked)}
                />
                <Label htmlFor="am-midnight" className="text-sm">
                  Crosses midnight
                </Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* PM Shift */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">PM Shift</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="pm-start">Start Time</Label>
                <Input
                  id="pm-start"
                  type="time"
                  value={config.pm.start}
                  onChange={(e) => updatePmShift('start', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pm-end">End Time</Label>
                <Input
                  id="pm-end"
                  type="time"
                  value={config.pm.end}
                  onChange={(e) => updatePmShift('end', e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="pm-midnight"
                  checked={config.pm.cross_midnight}
                  onCheckedChange={(checked) => updatePmShift('cross_midnight', checked)}
                />
                <Label htmlFor="pm-midnight" className="text-sm">
                  Crosses midnight
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Attendance Policies
          </CardTitle>
          <CardDescription>
            Configure tardiness and early dismissal thresholds
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tardy-minutes">Tardy Threshold (minutes)</Label>
              <Input
                id="tardy-minutes"
                type="number"
                min="0"
                max="60"
                value={config.tardy_minutes}
                onChange={(e) => updatePolicy('tardy_minutes', parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minutes late before considered tardy
              </p>
            </div>
            <div>
              <Label htmlFor="early-minutes">Early Dismissal Threshold (minutes)</Label>
              <Input
                id="early-minutes"
                type="number"
                min="0"
                max="120"
                value={config.early_minutes}
                onChange={(e) => updatePolicy('early_minutes', parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minutes early before considered early dismissal
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Timezone & Regional Settings
          </CardTitle>
          <CardDescription>
            Configure timezone for accurate time calculations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Select value={config.timezone} onValueChange={(value) => updatePolicy('timezone', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {timezones.map(tz => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto">
            {JSON.stringify(config, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};