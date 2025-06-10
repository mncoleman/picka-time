import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Users, Calendar, Clock, Trophy, Copy, ExternalLink, Trash2, Ban } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface CalendarData {
  id: string;
  name: string;
  description?: string;
  max_selections: number;
  start_date: string;
  end_date: string;
  time_slots: string[];
  created_by: string;
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
  created_at: string;
}

interface TimeSlotCount {
  datetime: string;
  date: string;
  time: string;
  count: number;
  participants: string[];
}

const Results = () => {
  const { calendarId } = useParams();
  const { user } = useAuth();
  const [calendar, setCalendar] = useState<CalendarData | null>(null);
  const [responses, setResponses] = useState<TimeSlotResponse[]>([]);
  const [timeSlotCounts, setTimeSlotCounts] = useState<TimeSlotCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (calendarId) {
      fetchCalendar();
      fetchResponses();
      subscribeToChanges();
    }
  }, [calendarId]);

  useEffect(() => {
    if (responses.length > 0) {
      calculateTimeSlotCounts(responses);
    }
  }, [responses]);

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
    }
  };

  const fetchResponses = async () => {
    try {
      const { data, error } = await supabase
        .from('time_slot_responses')
        .select('*')
        .eq('calendar_id', calendarId)
        .order('created_at', { ascending: false });

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
    } finally {
      setLoading(false);
    }
  };

  const subscribeToChanges = () => {
    const channel = supabase
      .channel(`results_${calendarId}`)
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

  const calculateTimeSlotCounts = (responses: TimeSlotResponse[]) => {
    const counts: { [key: string]: TimeSlotCount } = {};

    responses.forEach(response => {
      response.selected_slots.forEach((slot: any) => {
        const key = slot.datetime;
        if (!counts[key]) {
          counts[key] = {
            datetime: key,
            date: slot.date,
            time: slot.time,
            count: 0,
            participants: []
          };
        }
        counts[key].count++;
        counts[key].participants.push(response.user_name);
      });
    });

    const sortedCounts = Object.values(counts).sort((a, b) => b.count - a.count);
    setTimeSlotCounts(sortedCounts);
  };

  const getBadgeVariant = (count: number, maxCount: number) => {
    if (maxCount === 0) return "outline";
    const percentage = count / maxCount;
    if (percentage >= 0.8) return "default";
    if (percentage >= 0.6) return "secondary";
    return "outline";
  };

  const getShareableLink = () => {
    return `${window.location.origin}${window.location.pathname}#/calendar/${calendarId}`;
  };

  const copyShareableLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareableLink());
      toast.success("Link copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading results...</p>
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

  const maxResponseCount = responses.length;
  const topTimeSlots = timeSlotCounts.slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Link to="/admin">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Admin
                </Button>
              </Link>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{calendar.name} - Results</h1>
              {calendar.description && (
                <p className="text-muted-foreground mt-2">{calendar.description}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <Badge variant="outline" className="gap-1">
                <Users className="h-3 w-3" />
                {responses.length} responses
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Calendar className="h-3 w-3" />
                {format(parseISO(calendar.start_date), 'MMM d')} - {format(parseISO(calendar.end_date), 'MMM d')}
              </Badge>
              {calendar.is_disabled && (
                <Badge variant="destructive" className="gap-1">
                  <Ban className="h-3 w-3" />
                  Disabled
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {topTimeSlots.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-600" />
                    Best Time Slots
                  </CardTitle>
                  <CardDescription>
                    Time slots with the highest availability
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topTimeSlots.map((slot, index) => (
                      <div key={slot.datetime} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-800' :
                            index === 1 ? 'bg-gray-100 text-gray-800' :
                            index === 2 ? 'bg-orange-100 text-orange-800' :
                            'bg-blue-50 text-blue-800'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-semibold">
                              {format(parseISO(slot.date), 'EEEE, MMM d')} at {slot.time}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {slot.participants.join(', ')}
                            </p>
                          </div>
                        </div>
                        <Badge variant={getBadgeVariant(slot.count, maxResponseCount)}>
                          {slot.count}/{maxResponseCount}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>All Time Slots</CardTitle>
                <CardDescription>
                  Complete availability breakdown
                </CardDescription>
              </CardHeader>
              <CardContent>
                {timeSlotCounts.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No responses yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Share the calendar link to start collecting availability
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Available</TableHead>
                        <TableHead className="hidden md:table-cell">Participants</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeSlotCounts.map(slot => (
                        <TableRow key={slot.datetime}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">
                                  {format(parseISO(slot.date), 'MMM d')} at {slot.time}
                                </div>
                                <div className="text-xs text-muted-foreground md:hidden">
                                  {slot.participants.join(', ')}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getBadgeVariant(slot.count, maxResponseCount)}>
                              {slot.count}/{maxResponseCount}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                            {slot.participants.join(', ')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Share Calendar</CardTitle>
                <CardDescription>
                  Send this link to participants
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={getShareableLink()}
                      className="text-xs"
                    />
                    <Button size="sm" onClick={copyShareableLink}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Link to={`/calendar/${calendarId}`} target="_blank">
                    <Button variant="outline" size="sm" className="w-full">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Preview Calendar
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Responses ({responses.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {responses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No responses yet</p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {responses.map(response => (
                      <div key={response.id} className="p-3 border rounded">
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <div className="font-medium text-sm">{response.user_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(parseISO(response.created_at), 'MMM d, h:mm a')}
                            </div>
                          </div>
                          <ConfirmDialog
                            trigger={
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            }
                            title="Delete Response"
                            description={`Are you sure you want to delete ${response.user_name}'s response? This action cannot be undone.`}
                            confirmText="Delete"
                            variant="destructive"
                            onConfirm={async () => {
                              try {
                                const { error } = await supabase
                                  .from('time_slot_responses')
                                  .delete()
                                  .eq('id', response.id);

                                if (error) throw error;
                                toast.success('Response deleted successfully');
                                fetchResponses();
                              } catch (error) {
                                console.error('Error deleting response:', error);
                                toast.error('Failed to delete response');
                              }
                            }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {response.selected_slots.length} slots selected
                        </div>
                        {response.user_email && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {response.user_email}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Results;
