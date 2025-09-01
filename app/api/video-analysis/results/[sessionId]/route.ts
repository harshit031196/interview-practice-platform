import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Get video analysis results for a specific session
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    // Check authentication - support both session and API key
    const session = await getServerSession(authOptions);
    const apiKey = request.headers.get('x-api-key');
    const expectedApiKey = process.env.API_SECRET_KEY;
    
    // Allow access if either valid session OR valid API key
    const isAuthenticated = session || (apiKey && expectedApiKey && apiKey === expectedApiKey);
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = params;

    // Try to find stored video analysis results
    // For API key auth, we can't filter by userId since there's no session
    const whereClause = session?.user?.id 
      ? { sessionId: sessionId, userId: session.user.id }
      : { sessionId: sessionId };
    
    const analysisResult = await prisma.videoAnalysis.findFirst({
      where: whereClause,
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!analysisResult) {
      return NextResponse.json({ 
        error: 'No video analysis found for this session' 
      }, { status: 404 });
    }

    // Parse the stored JSON results
    const analysisData = JSON.parse(analysisResult.results);

    // Handle both new (flat) and old (nested) data structures for backward compatibility.
    if (analysisData && analysisData.results) {
      // Old format: data is nested inside a 'results' key.
      return NextResponse.json(analysisData.results);
    } else {
      // New format: data is already in the correct flat structure.
      return NextResponse.json(analysisData);
    }

  } catch (error) {
    console.error('Error fetching video analysis results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analysis results' },
      { status: 500 }
    );
  }
}

// Store video analysis results for a session
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    // Check authentication - support both session and API key
    const session = await getServerSession(authOptions);
    const apiKey = request.headers.get('x-api-key');
    const expectedApiKey = process.env.API_SECRET_KEY;
    
    // Allow access if either valid session OR valid API key
    const isAuthenticated = session || (apiKey && expectedApiKey && apiKey === expectedApiKey);
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = params;
    const analysisData = await request.json();

    // Store the analysis results
    // For API key auth, we need to handle the case where there's no user session
    if (session?.user?.id) {
      // Session-based auth - store with user ID
      const result = await prisma.videoAnalysis.upsert({
        where: {
          sessionId_userId: {
            sessionId: sessionId,
            userId: session.user.id,
          }
        },
        update: {
          results: JSON.stringify(analysisData),
          updatedAt: new Date(),
        },
        create: {
          sessionId: sessionId,
          userId: session.user.id,
          results: JSON.stringify(analysisData),
        },
      });
      
      return NextResponse.json({
        success: true,
        analysisId: result.id,
      });
    } else {
      // API key auth - skip database storage since we don't have a user ID
      console.log('Skipping database storage - API key authentication used (no user session)');
      return NextResponse.json({
        success: true,
        message: 'Analysis completed but not stored (API key authentication)',
      });
    }

  } catch (error) {
    console.error('Error storing video analysis results:', error);
    return NextResponse.json(
      { error: 'Failed to store analysis results' },
      { status: 500 }
    );
  }
}
