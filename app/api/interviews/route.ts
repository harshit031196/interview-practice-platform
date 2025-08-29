import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Get all interviews for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user;

    const sessions = await prisma.interviewSession.findMany({
      where: {
        intervieweeId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const interviews = sessions.map((session: any) => ({
      id: session.id,
      type: session.type,
      interviewType: session.interviewType || 'General',
      difficulty: session.difficulty || 'Medium',
      duration: session.duration || 15,
      status: session.status,
      createdAt: session.createdAt,
      hasFeedback: false, // Will be updated when feedback system is fully integrated
      overallScore: null,
      speakingPaceWpm: null,
      fillerWordCount: null,
      clarityScore: null,
      emotionSummary: null,
      contentSummary: null,
    }));

    return NextResponse.json({ interviews });

  } catch (error) {
    console.error('Error fetching interviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interviews' },
      { status: 500 }
    );
  }
}
