-- Drop any existing policies
DROP POLICY IF EXISTS "Allow authenticated users to create responses" ON time_slot_responses;
DROP POLICY IF EXISTS "Allow anonymous users to create responses" ON time_slot_responses;
DROP POLICY IF EXISTS "Allow users to read all responses" ON time_slot_responses;

-- Enable RLS on the table if not already enabled
ALTER TABLE time_slot_responses ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous submissions
CREATE POLICY "Allow anonymous submissions"
ON time_slot_responses
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Create policy to allow reading responses
CREATE POLICY "Allow reading responses"
ON time_slot_responses
FOR SELECT
TO anon, authenticated
USING (true);

-- Create policy to allow deleting responses (admin only)
CREATE POLICY "Allow admin to delete responses"
ON time_slot_responses
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM calendars c 
  WHERE c.id = time_slot_responses.calendar_id 
  AND c.created_by = auth.uid()
));
