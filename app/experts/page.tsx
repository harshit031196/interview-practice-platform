'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ExpertCard } from '@/components/ExpertCard'
import { Badge } from '@/components/ui/badge'
import { WingmanHeader } from '@/components/WingmanHeader'
import { Search, Filter, Users } from 'lucide-react'

interface Expert {
  id: string
  name: string
  bio: string
  expertiseTags: string[]
  yearsExp: number
  verified: boolean
  rateCents?: number
  nextSlots: Array<{
    start: Date
    end: Date
  }>
}

export default function ExpertsPage() {
  const [filters, setFilters] = useState({
    search: '',
    tags: '',
    industry: '',
    availability: '',
  })

  const { data: experts, isLoading } = useQuery<Expert[]>({
    queryKey: ['experts', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.tags && filters.tags !== 'all') params.append('tags', filters.tags)
      if (filters.industry && filters.industry !== 'all') params.append('industry', filters.industry)
      if (filters.availability && filters.availability !== 'all') params.append('availabilityWindow', filters.availability)

      const response = await fetch(`/api/experts?${params}`)
      if (!response.ok) throw new Error('Failed to fetch experts')
      return response.json()
    },
  })

  const filteredExperts = experts?.filter(expert =>
    expert.name.toLowerCase().includes(filters.search.toLowerCase()) ||
    expert.bio.toLowerCase().includes(filters.search.toLowerCase()) ||
    expert.expertiseTags.some(tag => 
      tag.toLowerCase().includes(filters.search.toLowerCase())
    )
  ) || []

  const handleBookExpert = (expertId: string) => {
    // Navigate to expert detail page
    window.location.href = `/experts/${expertId}`
  }

  const popularTags = [
    'System Design', 'Product Strategy', 'Technical Leadership', 'Data Analysis',
    'User Research', 'Engineering Management', 'Scalability', 'Product Design'
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <WingmanHeader
        title="Expert Interviewers"
        subtitle="Book sessions with industry professionals"
        showBackButton={true}
        backHref="/dashboard"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="mb-6 text-center">
          <p className="text-lg text-muted-foreground">
            {filteredExperts.length} experts available
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Filter className="w-6 h-6" />
              Find Your Perfect Interviewer
            </CardTitle>
            <CardDescription className="text-lg">
              Filter by expertise, experience, and availability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or expertise..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Industry</label>
                <Select
                  value={filters.industry}
                  onValueChange={(value) => setFilters({ ...filters, industry: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any industry</SelectItem>
                    <SelectItem value="Technology">Technology</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="Healthcare">Healthcare</SelectItem>
                    <SelectItem value="Consulting">Consulting</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Experience</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Any experience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any experience</SelectItem>
                    <SelectItem value="5">5+ years</SelectItem>
                    <SelectItem value="10">10+ years</SelectItem>
                    <SelectItem value="15">15+ years</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Availability</label>
                <Select
                  value={filters.availability}
                  onValueChange={(value) => setFilters({ ...filters, availability: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="tomorrow">Tomorrow</SelectItem>
                    <SelectItem value="week">This week</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Popular Tags */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Popular Expertise</label>
              <div className="flex flex-wrap gap-2">
                {popularTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={filters.tags === tag ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => setFilters({ 
                      ...filters, 
                      tags: filters.tags === tag ? '' : tag 
                    })}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="h-80 animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                    <div className="flex gap-2">
                      <div className="h-6 bg-gray-200 rounded w-16"></div>
                      <div className="h-6 bg-gray-200 rounded w-20"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredExperts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExperts.map((expert) => (
              <ExpertCard
                key={expert.id}
                expert={expert}
                onBook={handleBookExpert}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No experts found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your filters or search terms
              </p>
              <Button 
                onClick={() => setFilters({ search: '', tags: '', industry: '', availability: '' })}
                variant="outline"
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}

        {/* CTA Section */}
        <Card className="mt-12 bg-primary text-primary-foreground">
          <CardContent className="text-center py-8">
            <h2 className="text-2xl font-bold mb-4">Want to become an expert interviewer?</h2>
            <p className="text-primary-foreground/80 mb-6 max-w-2xl mx-auto">
              Share your expertise, help others succeed, and earn money by conducting mock interviews.
            </p>
            <Button variant="secondary" size="lg">
              Apply to be an Interviewer
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
