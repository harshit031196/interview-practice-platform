import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';

// Initialize Vertex AI
const vertex_ai = new VertexAI({
  project: 'wingman-interview-470419',
  location: 'us-central1',
});

// Use the specified model
const model = 'gemini-2.5-flash';

export async function POST(request: NextRequest) {
  try {
    console.log('[API] POST /api/ai/interviewer - Checking authentication');
    
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
      console.error('[API] Unauthorized AI interviewer request - no valid session');
      return NextResponse.json({ error: 'Unauthorized - please sign in' }, { status: 401 });
    }
    
    console.log(`[API] User authenticated for AI interviewer: ${userId}`);

    const body = await request.json();
    const { 
      userResponse, 
      conversationHistory = [], 
      jobRole = 'Software Engineer',
      company = 'FAANG',
      interviewType = 'behavioral'
    } = body;

    console.log('Interviewer API called with:', { userResponse, conversationHistory, jobRole, company, interviewType });

    // System prompt for the AI interviewer
    const systemPrompt = `You are an experienced ${company} interviewer conducting a ${interviewType} interview for a ${jobRole} position. 

Your role:
- Ask CONCISE, direct questions (1-2 sentences maximum)
- Be brief and to the point - avoid lengthy explanations
- Focus on clear, specific questions that get straight to the point
- Maintain a professional tone
- Ask one question at a time
- Build upon previous responses naturally

Interview Type Guidelines:
${interviewType === 'behavioral' ? '- Focus on past experiences, leadership, teamwork, conflict resolution\n- Use brief "Tell me about..." questions\n- Keep questions under 15 words when possible' : ''}`;

    // Prepare the conversation context
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...conversationHistory,
    ];

    // Add user response if provided
    if (userResponse) {
      messages.push({
        role: 'user',
        content: userResponse
      });
    }

    // Generate AI response using Gemini
    const generativeModel = vertex_ai.preview.getGenerativeModel({
      model: model,
      generationConfig: {
        maxOutputTokens: 800, // Increased to ensure complete responses
        temperature: 0.5, // Lower temperature for more consistent responses
        topP: 0.8, // Balanced topP for controlled diversity
        topK: 30, // Adjusted topK for better sampling
        stopSequences: [], // No stop sequences to ensure complete responses
      },
      // Add safety settings to avoid empty responses due to safety filters
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
        }
      ],
    });

    // Convert messages to Gemini format
    const prompt = messages.map((msg: {role: string, content: string}) => {
      if (msg.role === 'system') return `System: ${msg.content}`;
      if (msg.role === 'user') return `Candidate: ${msg.content}`;
      return `Interviewer: ${msg.content}`;
    }).join('\n\n');

    console.log('Sending prompt to Gemini:', prompt);

    // Concise fallback questions by interview type
    const fallbackQuestions: Record<string, string[]> = {
      behavioral: [
        "Describe a challenge you overcame at work.",
        "How did you handle a difficult team member?",
        "Share a decision you made with limited information.",
        "What's a failure you learned from?",
        "Tell me about a time you led a project.",
        "Describe a situation where you had to meet a tight deadline.",
        "How have you handled disagreements with your manager?",
        "Tell me about a time you went above and beyond.",
        "How do you handle stress or pressure?",
        "Describe a time you had to adapt to a significant change.",
        "Tell me about a time you received difficult feedback.",
        "How have you resolved conflicts in your team?",
        "Describe a situation where you influenced others without authority.",
        "Tell me about a time you had to make an unpopular decision."
      ],
      technical: [
        "How do you debug complex issues?",
        "How do you stay updated with new technologies?",
        "What technical project are you most proud of?",
        "How do you ensure code maintainability?"
      ],
      'system-design': [
        "How would you design a URL shortening service like bit.ly?",
        "Can you walk me through how you would design a distributed cache?",
        "How would you design a notification system that can handle millions of users?",
        "What considerations would you make when designing a real-time chat application?"
      ],
      product: [
        "How do you prioritize product features?",
        "Describe a product trade-off you had to make.",
        "How do you measure feature success?",
        "How do you understand user needs?"
      ]
    };
    
    let aiResponse;
    try {
      console.log('[API] Calling Gemini API with model:', model);
      const result = await generativeModel.generateContent(prompt);
      const response = result.response;
      
      // Log the response structure for debugging
      console.log('[API] Gemini response structure:', {
        hasResponse: !!response,
        hasCandidates: !!response?.candidates && Array.isArray(response?.candidates),
        candidatesLength: response?.candidates?.length || 0,
        hasContent: !!response?.candidates?.[0]?.content,
        hasParts: !!response?.candidates?.[0]?.content?.parts,
        partsLength: response?.candidates?.[0]?.content?.parts?.length || 0,
        hasText: !!response?.candidates?.[0]?.content?.parts?.[0]?.text
      });
      
      // Check for the 'role: model' pattern which indicates a filtered response
      const hasRoleModel = response?.candidates?.[0]?.content?.role === 'model';
      const hasEmptyParts = !response?.candidates?.[0]?.content?.parts || 
                          !response?.candidates?.[0]?.content?.parts?.[0]?.text;
      const hasEmptyContent = !response?.candidates?.[0]?.content || 
                            Object.keys(response?.candidates?.[0]?.content || {}).length <= 1;
      
      if ((hasRoleModel && (hasEmptyParts || hasEmptyContent))) {
        console.log('[API] Detected "role: model" response pattern - using intelligent fallback');
        
        // Use a context-aware fallback based on conversation history
        let fallbackType = interviewType;
        let contextualFallback = '';
        
        // If we have conversation history, generate a more contextual fallback
        if (userResponse && conversationHistory.length > 0) {
          const lastUserMessage = userResponse;
          
          // Product interview specific contextual fallbacks
          if (interviewType === 'product') {
            if (lastUserMessage.toLowerCase().includes('unified') || 
                lastUserMessage.toLowerCase().includes('flow') || 
                lastUserMessage.toLowerCase().includes('process')) {
              contextualFallback = "What metrics would you use to measure the success of this unified sharing flow?";
            } else if (lastUserMessage.toLowerCase().includes('user') && 
                      (lastUserMessage.toLowerCase().includes('problem') || 
                       lastUserMessage.toLowerCase().includes('pain') || 
                       lastUserMessage.toLowerCase().includes('issue'))) {
              contextualFallback = "How would you prioritize solving this problem against other user issues?";
            }
          }
        }
        
        // If we generated a contextual fallback, use it; otherwise use a random fallback
        if (contextualFallback) {
          console.log('[API] Using contextual fallback question:', contextualFallback);
          return NextResponse.json({ question: contextualFallback });
        } else {
          // Use a fallback question based on interview type
          const fallbackQuestion = fallbackQuestions[fallbackType] || fallbackQuestions.behavioral;
          const selectedFallback = fallbackQuestion[Math.floor(Math.random() * fallbackQuestion.length)];
          console.log('[API] Using random fallback question for', interviewType, 'interview:', selectedFallback);
          return NextResponse.json({ question: selectedFallback });
        }
      }
      
      // Check if parts array exists and has text content
      const hasParts = !!response?.candidates?.[0]?.content?.parts && 
                      Array.isArray(response?.candidates?.[0]?.content?.parts) && 
                      response?.candidates?.[0]?.content?.parts.length > 0;
      
      // Try multiple ways to extract text from the response
      let extractedResponse = null;
      
      // Method 1: Standard parts[0].text extraction
      if (hasParts && response?.candidates?.[0]?.content?.parts?.[0]?.text) {
        extractedResponse = response.candidates[0].content.parts[0].text;
        console.log('[API] Extracted text using Method 1:', extractedResponse);
      } 
      // Method 2: Check if parts has any text property in any element
      else if (hasParts && response?.candidates?.[0]?.content?.parts) {
        const parts = response.candidates[0].content.parts;
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
            extractedResponse = part.text;
            console.log('[API] Extracted text using Method 2:', extractedResponse);
            break;
          }
        }
      }
      // Method 3: Check if content has any string property we can use
      else if (response?.candidates?.[0]?.content) {
        const content = response.candidates[0].content;
        // Try to find any string property in the content object
        for (const key in content) {
          if (typeof (content as any)[key] === 'string' && (content as any)[key].length > 0) {
            extractedResponse = (content as any)[key];
            console.log('[API] Extracted text using Method 3:', key);
            break;
          }
        }
      }
      
      // Assign the extracted response to aiResponse
      aiResponse = extractedResponse;
      
      // Dump the full response structure for debugging
      console.log('[API] Full response structure:', JSON.stringify(response?.candidates?.[0]?.content, null, 2));
      
      // Validate response content
      if (!hasParts || !aiResponse || aiResponse.trim() === '') {
        console.log('API response structure:', JSON.stringify(response, null, 2));
        console.error('Empty or invalid response from Gemini API. Using fallback question for', interviewType, 'interview');
        
        // Use a fallback question based on interview type
        const fallbackQuestion = fallbackQuestions[interviewType] || fallbackQuestions.behavioral;
        return NextResponse.json({ question: fallbackQuestion[Math.floor(Math.random() * fallbackQuestion.length)] });
      }
    } catch (error) {
      console.error('[API] Error generating content from Gemini:', error);
      
      // Select a random fallback question based on interview type
      const fallbackType = interviewType in fallbackQuestions ? interviewType : 'behavioral';
      const fallbackOptions = fallbackQuestions[fallbackType as keyof typeof fallbackQuestions];
      const randomIndex = Math.floor(Math.random() * fallbackOptions.length);
      aiResponse = fallbackOptions[randomIndex];
      
      console.log(`[API] Using fallback question for ${interviewType} interview:`, aiResponse);
    }

    // Store the extracted response in a local variable to prevent it from being lost
    const extractedAiResponse = aiResponse;
    console.log('Generated AI response:', extractedAiResponse);

    // Ensure we have a valid response
    let finalResponse = extractedAiResponse;
    if (!finalResponse || finalResponse.trim() === '') {
      console.error('[API] Final aiResponse is empty or undefined, using fallback');
      // Use a fallback question based on interview type
      const fallbackQuestion = fallbackQuestions[interviewType] || fallbackQuestions.behavioral;
      finalResponse = fallbackQuestion[Math.floor(Math.random() * fallbackQuestion.length)];
      console.log('[API] Using fallback question:', finalResponse);
    }

    // Create updated conversation history for the response
    // We don't need to persist this in the database as the frontend maintains the conversation state
    const updatedHistory = [
      ...messages,
      {
        role: 'assistant',
        content: finalResponse
      }
    ];
    
    // Log the updated conversation history
    console.log('[API] Updated conversation history:', updatedHistory.length, 'messages');

    // Return the final response
    return NextResponse.json({ question: finalResponse });

  } catch (error) {
    console.error('[API] AI Interviewer error:', error);
    return NextResponse.json(
      { error: 'Failed to generate interview question', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
