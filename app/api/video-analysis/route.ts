import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const VIDEO_ANALYSIS_FUNCTION_URL = process.env.VIDEO_ANALYSIS_FUNCTION_URL || 'https://your-region-your-project.cloudfunctions.net/analyze_video';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { videoUri, sessionId, analysisType = 'comprehensive' } = body;

    if (!videoUri) {
      return NextResponse.json({ error: 'videoUri is required' }, { status: 400 });
    }

    // Call the Google Cloud Function for video analysis
    const analysisResponse = await fetch(VIDEO_ANALYSIS_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoUri,
        analysisType,
        userId: session.user?.id,
      }),
    });

    if (!analysisResponse.ok) {
      const errorData = await analysisResponse.json();
      return NextResponse.json(
        { error: errorData.error || 'Analysis failed' },
        { status: analysisResponse.status }
      );
    }

    const analysisResult = await analysisResponse.json();

    // Store analysis result in database
    if (sessionId && session.user?.id) {
      try {
        await (prisma as any).videoAnalysis.upsert({
          where: {
            sessionId_userId: {
              sessionId: sessionId,
              userId: session.user.id,
            }
          },
          update: {
            results: JSON.stringify(analysisResult),
            updatedAt: new Date(),
          },
          create: {
            sessionId: sessionId,
            userId: session.user.id,
            results: JSON.stringify(analysisResult),
          },
        });
        console.log('Analysis results stored successfully for session:', sessionId);
      } catch (dbError) {
        console.error('Failed to store analysis results:', dbError);
        // Continue execution - don't fail the request if DB storage fails
      }
    }

    return NextResponse.json(analysisResult);
  } catch (error) {
    console.error('Video analysis API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('analysisId');

    if (!analysisId) {
      return NextResponse.json({ error: 'analysisId is required' }, { status: 400 });
    }

    // Retrieve analysis result from database
    // This would typically fetch from your database
    // For now, return a placeholder response
    return NextResponse.json({ 
      message: 'Analysis retrieval not implemented yet',
      analysisId 
    });
  } catch (error) {
    console.error('Get analysis error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
