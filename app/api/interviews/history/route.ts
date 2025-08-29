import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's interview sessions with video analysis data
    const sessions = await prisma.interviewSession.findMany({
      where: {
        OR: [
          { intervieweeId: session.user.id },
          { interviewerId: session.user.id }
        ]
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get video analysis results for sessions that have them
    const sessionsWithAnalysis = await Promise.all(
      sessions.map(async (sessionData) => {
        let analysisData = null;
        let hasVideoAnalysis = false;

        // Check if this session has video analysis
        const videoAnalysis = await prisma.videoAnalysis.findFirst({
          where: {
            sessionId: sessionData.id,
            userId: session.user.id
          },
          orderBy: {
            createdAt: 'desc'
          }
        });

        if (videoAnalysis) {
          hasVideoAnalysis = true;
          try {
            analysisData = JSON.parse(videoAnalysis.results);
          } catch (e) {
            console.error('Error parsing analysis data:', e);
          }
        }

        return {
          id: sessionData.id,
          createdAt: sessionData.createdAt.toISOString(),
          type: sessionData.type,
          status: sessionData.status,
          duration: sessionData.endedAt && sessionData.startedAt 
            ? Math.floor((sessionData.endedAt.getTime() - sessionData.startedAt.getTime()) / 1000)
            : null,
          hasVideoAnalysis,
          analysisData
        };
      })
    );

    return NextResponse.json({
      sessions: sessionsWithAnalysis,
      total: sessions.length
    });

  } catch (error) {
    console.error('Error fetching interview history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interview history' },
      { status: 500 }
    );
  }
}
