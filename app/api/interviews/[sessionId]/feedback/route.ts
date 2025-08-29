import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Get feedback for a specific interview session
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const authSession = await getServerSession(authOptions);
    if (!authSession?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = params;

    // Find the interview session and its feedback
    const interviewSession = await prisma.interviewSession.findFirst({
      where: {
        id: sessionId,
        intervieweeId: authSession.user.id,
      },
    });

    if (!interviewSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Try to find feedback separately - using any to bypass TypeScript issues
    const feedback = await (prisma as any).interviewFeedback.findUnique({
      where: {
        sessionId: sessionId,
      },
    });

    if (!feedback) {
      return NextResponse.json({ error: 'No feedback available yet' }, { status: 404 });
    }

    return NextResponse.json({
      feedback: feedback,
      session: {
        id: interviewSession.id,
        type: interviewSession.type,
        createdAt: interviewSession.createdAt,
        updatedAt: (interviewSession as any).updatedAt,
      },
    });

  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    );
  }
}

// Store feedback results from Cloud Function
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const feedbackData = await request.json();

    // Validate required fields
    if (!feedbackData.transcript || !feedbackData.analysis_metrics || !feedbackData.content_feedback) {
      return NextResponse.json(
        { error: 'Invalid feedback data structure' },
        { status: 400 }
      );
    }

    // Find the interview session
    const interviewSession = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
    });

    if (!interviewSession) {
      return NextResponse.json(
        { error: 'Interview session not found' },
        { status: 404 }
      );
    }

    // Store or update feedback
    const feedback = await (prisma as any).interviewFeedback.upsert({
      where: { sessionId: sessionId },
      update: {
        transcript: feedbackData.transcript,
        speakingPaceWpm: feedbackData.analysis_metrics.speaking_pace_wpm,
        fillerWordCount: feedbackData.analysis_metrics.filler_word_count,
        clarityScore: feedbackData.analysis_metrics.clarity_score || 0,
        emotionTimeline: JSON.stringify(feedbackData.emotion_timeline),
        contentFeedback: JSON.stringify(feedbackData.content_feedback),
        processingMetadata: JSON.stringify(feedbackData.processing_metadata || {}),
      },
      create: {
        sessionId: sessionId,
        transcript: feedbackData.transcript,
        speakingPaceWpm: feedbackData.analysis_metrics.speaking_pace_wpm,
        fillerWordCount: feedbackData.analysis_metrics.filler_word_count,
        clarityScore: feedbackData.analysis_metrics.clarity_score || 0,
        emotionTimeline: JSON.stringify(feedbackData.emotion_timeline),
        contentFeedback: JSON.stringify(feedbackData.content_feedback),
        processingMetadata: JSON.stringify(feedbackData.processing_metadata || {}),
      },
    });

    // Update session status
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: { 
        status: 'COMPLETED',
        endedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      feedbackId: feedback.id,
    });

  } catch (error) {
    console.error('Error storing feedback:', error);
    return NextResponse.json(
      { error: 'Failed to store feedback' },
      { status: 500 }
    );
  }
}
