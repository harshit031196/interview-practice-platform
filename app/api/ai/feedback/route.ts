import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { VertexAI } from '@google-cloud/vertexai';

// Initialize Vertex AI
const vertex_ai = new VertexAI({
  project: 'wingman-interview-470419',
  location: 'us-central1',
});

const model = 'gemini-1.5-pro';

export async function POST(request: NextRequest) {
  try {
    console.log('[API] POST /api/ai/feedback - Checking authentication');
    
    // Try to get user from JWT token first
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    
    // Then try to get user from database session
    const session = await getServerSession(authOptions);
    
    // Get user ID from either JWT token or session
    let userId = token?.sub || session?.user?.id;
    
    // If no JWT or session, check for database session directly
    if (!userId) {
      // Check standard session token first
      let sessionToken = request.cookies.get('next-auth.session-token')?.value;
      
      // If not found, check for database-specific session token (for hybrid fallback)
      if (!sessionToken) {
        sessionToken = request.cookies.get('next-auth.database-session')?.value;
        if (sessionToken) {
          console.log('[API] Found database-specific session token');
        }
      }
      
      if (sessionToken) {
        console.log('[API] Checking database session with token');
        try {
          const dbSession = await prisma.session.findUnique({
            where: { sessionToken },
            include: { user: true },
          });
          
          if (dbSession && dbSession.expires > new Date()) {
            userId = dbSession.userId;
            console.log('[API] Authenticated via database session for user ID:', userId);
          } else {
            console.log('[API] Database session invalid or expired');
          }
        } catch (error) {
          console.error('[API] Error checking database session:', error);
        }
      }
    }
    
    if (!userId) {
      console.error('[API] Unauthorized AI feedback request - no valid session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log(`[API] User authenticated for AI feedback: ${userId}`);

    const body = await request.json();
    const { 
      conversationTranscript, 
      jobRole = 'Software Engineer',
      company = 'FAANG',
      interviewType = 'behavioral',
      sessionId 
    } = body;

    if (!conversationTranscript) {
      return NextResponse.json({ error: 'No conversation transcript provided' }, { status: 400 });
    }

    console.log('Generating feedback for transcript:', conversationTranscript.substring(0, 200) + '...');

    // System prompt for feedback analysis
    const systemPrompt = `You are an expert interview coach analyzing a behavioral interview conversation. 

Analyze the following interview transcript and provide comprehensive feedback in JSON format.

Focus on:
1. STAR Method Usage (Situation, Task, Action, Result)
2. Communication Skills (clarity, structure, conciseness)
3. Behavioral Competencies
4. Overall Performance
5. Specific Improvement Areas
6. Sample Better Responses

Return your analysis in this exact JSON structure:
{
  "overallScore": number (0-100),
  "starMethodAnalysis": {
    "score": number (0-100),
    "feedback": "detailed feedback",
    "examples": [
      {
        "question": "question text",
        "response": "candidate response",
        "situation": "extracted situation or 'Not clearly defined'",
        "task": "extracted task or 'Not clearly defined'", 
        "action": "extracted action or 'Not clearly defined'",
        "result": "extracted result or 'Not clearly defined'",
        "score": number (0-10),
        "feedback": "specific feedback for this response"
      }
    ]
  },
  "communicationSkills": {
    "clarity": {"score": number (0-100), "feedback": "feedback"},
    "structure": {"score": number (0-100), "feedback": "feedback"},
    "conciseness": {"score": number (0-100), "feedback": "feedback"}
  },
  "strengths": ["strength1", "strength2", "strength3"],
  "improvementAreas": ["area1", "area2", "area3"],
  "interviewTips": ["tip1", "tip2", "tip3"],
  "sampleResponses": [
    {
      "question": "question",
      "improvedResponse": "better response using STAR method"
    }
  ]
}`;

    // Generate AI feedback using Gemini
    const generativeModel = vertex_ai.preview.getGenerativeModel({
      model: model,
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.3,
        topP: 0.8,
      },
    });

    const prompt = `${systemPrompt}\n\nInterview Transcript:\n${conversationTranscript}`;
    
    const result = await generativeModel.generateContent(prompt);
    const response = result.response;
    const aiResponse = response.candidates?.[0]?.content?.parts?.[0]?.text || '{"error": "Failed to generate analysis"}';

    // Parse the JSON response
    let analysis;
    try {
      analysis = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse);
      analysis = {
        overallScore: 70,
        starMethodAnalysis: {
          score: 65,
          feedback: "Analysis could not be completed due to parsing error.",
          examples: []
        },
        communicationSkills: {
          clarity: { score: 70, feedback: "Generally clear communication." },
          structure: { score: 65, feedback: "Some structure present." },
          conciseness: { score: 70, feedback: "Reasonably concise responses." }
        },
        strengths: ["Engaged in conversation", "Provided responses", "Showed interest"],
        improvementAreas: ["Use STAR method more consistently", "Provide more specific examples", "Structure responses better"],
        interviewTips: ["Practice STAR method", "Prepare specific examples", "Focus on quantifiable results"],
        sampleResponses: []
      };
    }

    console.log('AI feedback generated successfully');

    return NextResponse.json({
      success: true,
      analysis,
      sessionId,
      transcript: conversationTranscript
    });

  } catch (error) {
    console.error('[API] Error generating feedback:', error);
    return NextResponse.json(
      { error: 'Failed to generate feedback', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Get existing feedback for a session
export async function GET(request: NextRequest) {
  try {
    console.log('[API] GET /api/ai/feedback - Checking authentication');
    
    // Try to get user from JWT token first
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    
    // Then try to get user from database session
    const session = await getServerSession(authOptions);
    
    // Get user ID from either JWT token or session
    let userId = token?.sub || session?.user?.id;
    
    // If no JWT or session, check for database session directly
    if (!userId) {
      // Check standard session token first
      let sessionToken = request.cookies.get('next-auth.session-token')?.value;
      
      // If not found, check for database-specific session token (for hybrid fallback)
      if (!sessionToken) {
        sessionToken = request.cookies.get('next-auth.database-session')?.value;
        if (sessionToken) {
          console.log('[API] Found database-specific session token');
        }
      }
      
      if (sessionToken) {
        console.log('[API] Checking database session with token');
        try {
          const dbSession = await prisma.session.findUnique({
            where: { sessionToken },
            include: { user: true },
          });
          
          if (dbSession && dbSession.expires > new Date()) {
            userId = dbSession.userId;
            console.log('[API] Authenticated via database session for user ID:', userId);
          } else {
            console.log('[API] Database session invalid or expired');
          }
        } catch (error) {
          console.error('[API] Error checking database session:', error);
        }
      }
    }
    
    if (!userId) {
      console.error('[API] Unauthorized AI feedback request - no valid session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log(`[API] User authenticated for AI feedback: ${userId}`);

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // TODO: Implement database retrieval of stored feedback
    // For now, return placeholder
    return NextResponse.json({
      message: 'Feedback retrieval not yet implemented',
      sessionId
    });

  } catch (error) {
    console.error('[API] Get feedback error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve feedback', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
