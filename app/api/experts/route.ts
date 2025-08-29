import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const expertsQuerySchema = z.object({
  tags: z.string().optional(),
  industry: z.string().optional(),
  availabilityWindow: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tags = searchParams.get('tags')
    const industry = searchParams.get('industry')
    const availabilityWindow = searchParams.get('availabilityWindow')

    // Build where clause
    const where: any = {
      role: { in: ['INTERVIEWER', 'BOTH'] },
      interviewerProfile: {
        verified: true
      }
    }

    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim())
      where.interviewerProfile.expertiseTags = {
        hasSome: tagArray
      }
    }

    // Get interviewers with their profiles and availability
    const interviewers = await prisma.user.findMany({
      where,
      include: {
        interviewerProfile: {
          include: {
            availabilitySlots: {
              where: {
                start: {
                  gte: new Date()
                }
              },
              orderBy: {
                start: 'asc'
              },
              take: 3
            }
          }
        }
      }
    })

    const result = interviewers.map(interviewer => ({
      id: interviewer.id,
      name: interviewer.name,
      bio: interviewer.interviewerProfile?.bio,
      expertiseTags: interviewer.interviewerProfile?.expertiseTags || [],
      yearsExp: interviewer.interviewerProfile?.yearsExp,
      verified: interviewer.interviewerProfile?.verified,
      rateCents: interviewer.interviewerProfile?.rateCents,
      nextSlots: interviewer.interviewerProfile?.availabilitySlots.map(slot => ({
        start: slot.start,
        end: slot.end
      })) || []
    }))

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
