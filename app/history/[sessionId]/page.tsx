'use client'

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { WingmanHeader } from '@/components/WingmanHeader';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import VideoAnalysisResults from '@/components/VideoAnalysisResults';
import { Card, CardContent } from '@/components/ui/card';

export default function SessionReportPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const { data: session, isLoading, error } = useQuery({
    queryKey: ['interview_session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const response = await fetch(`/api/interviews/${sessionId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch session data');
      }
      return response.json();
    },
    enabled: !!sessionId,
  });

  if (isLoading) {
    return <LoadingAnimation message="Loading session report..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <WingmanHeader title="Error" showBackButton />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Card className="text-center">
            <CardContent className="pt-6">
              <p className="text-red-600">Could not load the session report.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <WingmanHeader title="Interview Report" subtitle={`Session ID: ${sessionId}`} showBackButton />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {session && <VideoAnalysisResults analysisData={session.analysisData} />}
      </div>
    </div>
  );
}
