import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const startAISessionSchema = z.object({
  jdId: z.string().optional(),
  interviewType: z.string(),
  difficulty: z.string(), 
  duration: z.number().min(5).max(60), // minutes
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { jdId, interviewType, difficulty, duration } = startAISessionSchema.parse(body)

    // Create AI session (skip credit check for now)
    const aiSession = await (prisma as any).interviewSession.create({
      data: {
        type: 'AI',
        status: 'SCHEDULED',
        intervieweeId: session.user.id,
        jdId,
        interviewType,
        difficulty,
        duration,
        startedAt: new Date()
      }
    })

    return NextResponse.json({ sessionId: aiSession.id })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
