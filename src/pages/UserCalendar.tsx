
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, Users } from "lucide-react";
import { format, addDays, parseISO } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";


interface CalendarData {
  id: string;
  name: string;
  description?: string;
  max_selections: number;
  start_date: string;
  end_date: string;
  time_slots: string[];
  is_disabled?: boolean;
}

interface TimeSlotResponse {
  id: string;
  user_name: string;
  user_email?: string;
  selected_slots: Array<{
    date: string;
    time: string;
    datetime: string;
  }>;
}

interface TimeSlot {
  date: Date;
  time: string;
  id: string;
}

const UserCalendar = () => {
  const { calendarId } = useParams();
  const [calendar, setCalendar] = useState<CalendarData | null>(null);
  const [responses, setResponses] = useState<TimeSlotResponse[]>([]);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (calendarId) {
      fetchCalendar();
      fetchResponses();
      subscribeToResponses();
    }
  }, [calendarId]);

  const fetchCalendar = async () => {
    try {
      const { data, error } = await supabase
        .from('calendars')
        .select('*')
        .eq('id', calendarId)
        .single();

      if (error) throw error;
      setCalendar(data);
    } catch (error) {
      console.error('Error fetching calendar:', error);
      toast.error('Calendar not found');
    } finally {
      setLoading(false);
    }
  };

  const fetchResponses = async () => {
    try {
      const { data, error } = await supabase
        .from('time_slot_responses')
        .select('*')
        .eq('calendar_id', calendarId);

      if (error) throw error;
      
      // Transform the data to match our interface
      const transformedData = data?.map(response => ({
        ...response,
        selected_slots: Array.isArray(response.selected_slots) 
          ? response.selected_slots as Array<{ date: string; time: string; datetime: string; }>
          : []
      })) || [];
      
      setResponses(transformedData);
    } catch (error) {
      console.error('Error fetching responses:', error);
    }
  };

  const subscribeToResponses = () => {
    const channel = supabase
      .channel(`calendar_${calendarId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_slot_responses',
          filter: `calendar_id=eq.${calendarId}`,
        },
        () => {
          fetchResponses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const generateDateRange = () => {
    if (!calendar) return [];
    const start = parseISO(calendar.start_date);
    const end = parseISO(calendar.end_date);
    const dates = [];
    let current = start;
    
    while (current <= end) {
      dates.push(new Date(current));
      current = addDays(current, 1);
    }
    
    return dates;
  };

  const toggleTimeSlot = (date: Date, time: string) => {
    if (calendar?.is_disabled) {
      toast.error("This calendar is currently disabled and not accepting submissions");
      return;
    }

    const slotId = `${format(date, 'yyyy-MM-dd')}-${time}`;
    const existingIndex = selectedSlots.findIndex(slot => slot.id === slotId);
    
    if (existingIndex >= 0) {
      setSelectedSlots(prev => prev.filter((_, index) => index !== existingIndex));
    } else {
      if (selectedSlots.length >= (calendar?.max_selections || 5)) {
        toast.error(`You can only select up to ${calendar?.max_selections} time slots`);
        return;
      }
      setSelectedSlots(prev => [...prev, { date, time, id: slotId }]);
    }
  };

  const isSlotSelected = (date: Date, time: string) => {
    const slotId = `${format(date, 'yyyy-MM-dd')}-${time}`;
    return selectedSlots.some(slot => slot.id === slotId);
  };

  const getSlotCount = (date: Date, time: string) => {
    const datetime = `${format(date, 'yyyy-MM-dd')} ${time}`;
    return responses.reduce((count, response) => {
      return count + (response.selected_slots.some(slot => slot.datetime === datetime) ? 1 : 0);
    }, 0);
  };

  const submitResponse = async () => {
    if (calendar?.is_disabled) {
      toast.error("This calendar is currently disabled and not accepting submissions");
      return;
    }

    if (!userName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    
    if (selectedSlots.length === 0) {
      toast.error("Please select at least one time slot");
      return;
    }

    setSubmitting(true);
    
    try {
      const response = {
        calendar_id: calendarId,
        user_name: userName.trim(),
        user_email: userEmail.trim() || null,
        selected_slots: selectedSlots.map(slot => ({
          date: format(slot.date, 'yyyy-MM-dd'),
          time: slot.time,
          datetime: `${format(slot.date, 'yyyy-MM-dd')} ${slot.time}`
        }))
      };

      const { error } = await supabase
        .from('time_slot_responses')
        .insert(response);

      if (error) throw error;

      toast.success("Your availability has been submitted!");
      setUserName("");
      setUserEmail("");
      setSelectedSlots([]);
    } catch (error) {
      console.error('Error submitting response:', error);
      toast.error("Failed to submit availability");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading calendar...</p>
        </div>
      </div>
    );
  }

  if (!calendar) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Calendar not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dateRange = generateDateRange();
  const totalResponses = responses.length;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="space-y-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{calendar.name}</h1>
              {calendar.description && (
                <p className="text-muted-foreground mt-2">{calendar.description}</p>
              )}
              <p className="text-muted-foreground mt-1">
                {calendar.is_disabled ? (
                  <span className="text-destructive">This calendar is currently disabled and not accepting submissions</span>
                ) : (
                  "Select all the time slots when you're available"
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Badge variant="outline" className="gap-1">
                <Calendar className="h-3 w-3" />
                {format(parseISO(calendar.start_date), 'MMM d')} - {format(parseISO(calendar.end_date), 'MMM d')}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <User className="h-3 w-3" />
                Max {calendar.max_selections} selections
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Users className="h-3 w-3" />
                {totalResponses} responses
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Available Time Slots</CardTitle>
                <CardDescription>
                  Click on time slots when you're available. Numbers show how many people selected each slot.
                  Selected: {selectedSlots.length}/{calendar.max_selections}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {dateRange.map(date => (
                    <div key={date.toISOString()}>
                      <h3 className="font-semibold text-lg mb-3 border-b pb-2">
                        {format(date, 'EEEE, MMMM d')}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {calendar.time_slots.map(time => {
                          const count = getSlotCount(date, time);
                          const isSelected = isSlotSelected(date, time);
                          return (
                            <Button
                              key={`${date.toISOString()}-${time}`}
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              onClick={() => toggleTimeSlot(date, time)}
                              className="relative text-xs h-12 flex flex-col gap-1"
                            >
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {time}
                              </div>
                              {count > 0 && (
                                <span className="text-xs opacity-70">
                                  {count} selected
                                </span>
                              )}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Submit Your Availability</CardTitle>
                <CardDescription>
                  Submit your selected time slots
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="userName">Your Name</Label>
                    <Input
                      id="userName"
                      placeholder="Enter your name"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="userEmail">Email (optional)</Label>
                    <Input
                      id="userEmail"
                      type="email"
                      placeholder="Enter your email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label>Selected Time Slots ({selectedSlots.length})</Label>
                  <div className="max-h-40 overflow-y-auto space-y-1 mt-2 border rounded-md p-2">
                    {selectedSlots.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No slots selected</p>
                    ) : (
                      selectedSlots.map(slot => (
                        <div key={slot.id} className="text-sm bg-muted p-2 rounded">
                          {format(slot.date, 'MMM d')} at {slot.time}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <Button 
                  onClick={submitResponse} 
                  className="w-full" 
                  disabled={submitting || calendar.is_disabled}
                >
                  {submitting ? "Submitting..." : calendar.is_disabled ? "Calendar is Disabled" : "Submit Availability"}
                </Button>
              </CardContent>
            </Card>

            {responses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Responses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {responses.slice(-5).reverse().map(response => (
                      <div key={response.id} className="p-2 border rounded text-sm">
                        <div className="font-medium">{response.user_name}</div>
                        <div className="text-muted-foreground text-xs">
                          {response.selected_slots.length} slots selected
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserCalendar;
