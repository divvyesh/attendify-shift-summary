-- Create database schema for multi-employee attendance system

-- Create stores table
CREATE TABLE public.stores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Create employees table
CREATE TABLE public.employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id TEXT NOT NULL,
    name TEXT NOT NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(employee_id)
);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Create attendance_records table
CREATE TABLE public.attendance_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    upload_session_id UUID,
    date DATE NOT NULL,
    shift TEXT NOT NULL CHECK (shift IN ('AM', 'PM')),
    scheduled_in TIMESTAMP WITH TIME ZONE,
    scheduled_out TIMESTAMP WITH TIME ZONE,
    actual_in TIMESTAMP WITH TIME ZONE,
    actual_out TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Late', 'Early-out')),
    scheduled_hours DECIMAL(5,2) DEFAULT 0,
    hours_worked DECIMAL(5,2) DEFAULT 0,
    attendance_pct DECIMAL(5,2) DEFAULT 0,
    is_tardy BOOLEAN DEFAULT false,
    is_early_out BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Create upload_sessions table to track file uploads
CREATE TABLE public.upload_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_names TEXT[] NOT NULL,
    processed_count INTEGER DEFAULT 0,
    total_records INTEGER DEFAULT 0,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    status TEXT DEFAULT 'completed' CHECK (status IN ('processing', 'completed', 'failed'))
);

-- Enable RLS
ALTER TABLE public.upload_sessions ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_employees_employee_id ON public.employees(employee_id);
CREATE INDEX idx_employees_store_id ON public.employees(store_id);
CREATE INDEX idx_attendance_records_employee_id ON public.attendance_records(employee_id);
CREATE INDEX idx_attendance_records_date ON public.attendance_records(date);
CREATE INDEX idx_attendance_records_upload_session ON public.attendance_records(upload_session_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_stores_updated_at
    BEFORE UPDATE ON public.stores
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON public.employees
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_attendance_records_updated_at
    BEFORE UPDATE ON public.attendance_records
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create policies for public access (since this is a demo app)
-- In production, you would tie these to user authentication

CREATE POLICY "Allow all operations on stores"
ON public.stores FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations on employees"
ON public.employees FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations on attendance_records"
ON public.attendance_records FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations on upload_sessions"
ON public.upload_sessions FOR ALL
USING (true)
WITH CHECK (true);

-- Insert sample stores
INSERT INTO public.stores (name, location) VALUES
('Back Bay', 'Boston, MA'),
('Cambridge', 'Cambridge, MA'),
('Somerville', 'Somerville, MA');